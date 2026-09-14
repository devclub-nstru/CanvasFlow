import { logger } from "@repo/logger";
import { recordMailSend } from "@repo/observability";

/* ── Outbound mail ─────────────────────────────────────────────────────────
 *
 * The product had no way to send email at all, which is why it had neither
 * address verification nor password reset.
 *
 * Two transports:
 *
 *   smtp  Any relay — SES, Postmark, Mailgun, Brevo, a corporate server, or
 *         Gmail with an app password. Enabled by SMTP_URL, or by SMTP_HOST
 *         plus credentials. SMTP rather than a vendor API because it is the
 *         one interface every provider speaks: changing provider is a change
 *         to .env, with nothing here to rewrite and no SDK to keep current.
 *         nodemailer is imported lazily, so a deployment that never sends mail
 *         never loads it.
 *
 *   log   The fallback when no relay is configured. It writes the message —
 *         including any link it contains — to the log instead of sending it,
 *         so local development works with no account anywhere and a
 *         misconfigured deployment is loud rather than silent.
 *
 * Note for anyone deploying on EC2: AWS blocks outbound port 25 by default and
 * mail from an EC2 address is distrusted regardless, so the relay has to be
 * somebody else's, reached on 587 or 465. Both are unaffected by that block.
 *
 * The callers deal in `MailMessage` and never in a provider, deliberately.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /* Both are always provided. Plain text is not optional politeness: a
   * text/html-only message scores worse with spam filters, and password-reset
   * mail landing in spam is the failure mode that matters most here. */
  html: string;
  text: string;
  /* Which template produced this, for the mail metric. A closed set — it is
   * set by the builders below, never by a caller, so it cannot become an
   * unbounded label. */
  template?: MailTemplate;
}

export type MailTemplate = "password_reset" | "signup_code" | "email_verification" | "unknown";

export type MailTransport = "smtp" | "log";

/* The relay host, from whichever of the two configuration styles is in use.
 * Empty when neither is set, which is what selects the log transport. */
function smtpHost(): string {
  const url = process.env.SMTP_URL?.trim();
  if (url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      /* Reported by senderConfigurationProblem; treated as unconfigured here
       * rather than throwing out of a getter. */
      return "";
    }
  }

  return process.env.SMTP_HOST?.trim().toLowerCase() ?? "";
}

export function activeMailTransport(): MailTransport {
  return smtpHost() ? "smtp" : "log";
}

export function isMailConfigured(): boolean {
  return activeMailTransport() !== "log";
}

/* Sender domains that can never work, and why they differ.
 *
 * A provider will only send from a domain whose DNS you control, because that
 * is how it publishes the DKIM and SPF records that stop the mail being
 * forged. Two distinct mistakes hit that rule, and they need different advice:
 *
 *   placeholder   Copied out of .env.example and never revisited.
 *
 *   consumer      A personal mailbox — gmail.com and friends. This is the more
 *                 common one and the more confusing, because the address is
 *                 perfectly valid mail: it works as a *recipient*, and the
 *                 instinct is that it should therefore work as a sender. It
 *                 cannot, ever, since the domain belongs to Google, not you.
 *                 No amount of retrying or re-issuing an API key changes it.
 */
const PLACEHOLDER_SENDER_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "yourdomain.com",
  "localhost",
];

const CONSUMER_SENDER_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "yandex.com",
  "mail.ru",
  "rediffmail.com",
];

let warnedAboutSender = false;

function senderDomain(address: string): string {
  const bare = (address.match(/<([^>]+)>/)?.[1] ?? address).trim();
  return bare.split("@")[1]?.toLowerCase() ?? "";
}

/* Why the configured sender cannot send, or null if it looks usable.
 *
 * "Looks usable" is as far as this can go — whether a domain is actually
 * verified with the provider is only knowable by asking the provider. This
 * catches the two cases that are wrong on their face, so they surface at boot
 * instead of as a 403 the first time someone signs up.
 */
/* Whether the relay is operated by the same company as the sender's domain —
 * smtp.gmail.com for a gmail.com sender. That combination is legitimate and
 * common: the message leaves Google's own infrastructure, signed by Google,
 * so the "you do not control this domain" objection does not apply to it. */
function relayBelongsToSenderDomain(domain: string): boolean {
  const host = smtpHost();
  if (!host || !domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

export function senderConfigurationProblem(): string | null {
  const url = process.env.SMTP_URL?.trim();
  if (url && !smtpHost()) {
    return (
      `SMTP_URL is "${url}", which is not a valid URL, so no relay is configured ` +
      "and mail is going to the log instead.\n" +
      "    Fix: use the form smtp://user:password@host:587 (or smtps://…:465), and " +
      "percent-encode any @ : or / in the password — or set SMTP_HOST, SMTP_PORT, " +
      "SMTP_USER and SMTP_PASSWORD separately, which avoids the escaping entirely."
    );
  }

  const configured = process.env.MAIL_FROM?.trim();

  /* There is no sandbox sender to fall back on, so an unset MAIL_FROM against
   * a configured relay is a real misconfiguration rather than a default. Most
   * relays reject a message with no From outright; the few that rewrite it do
   * so to the authenticating account, which is rarely what was intended. */
  if (!configured) {
    if (activeMailTransport() === "log") return null;
    if (smtpUser().includes("@")) return null;

    return (
      "MAIL_FROM is not set while a relay is configured, so outgoing mail has no " +
      "sender address and will be rejected.\n" +
      '    Fix: set MAIL_FROM to an address at a domain the relay is allowed to ' +
      'send for, for example "CanvasFlow <noreply@your-app-domain.com>".'
    );
  }

  const domain = senderDomain(configured);
  if (!domain) {
    return `MAIL_FROM is "${configured}", which has no domain part. Use an address like "CanvasFlow <noreply@yourdomain.com>".`;
  }

  /* Only a problem when relaying through somebody else. SES will not send as
   * you@gmail.com — it has no authority over gmail.com — but smtp.gmail.com
   * will, which is the case the check above lets through. */
  if (CONSUMER_SENDER_DOMAINS.includes(domain) && !relayBelongsToSenderDomain(domain)) {
    return (
      `MAIL_FROM is "${configured}", and ${domain} is a personal mailbox provider, ` +
      `but the relay is ${smtpHost() || "a third party"}. Mail can be sent TO an ` +
      "address there, but a relay only sends FROM a domain whose DNS you control, " +
      `so it can publish DKIM and SPF records — and ${domain} belongs to its ` +
      "operator rather than to you. Every message will be rejected with a " +
      "domain-not-verified error, no matter how many times it is retried.\n" +
      "    Fix: set MAIL_FROM to an address at a domain you own and have verified " +
      `with the relay (for example noreply@your-app-domain.com), or relay through ` +
      `${domain}'s own SMTP server instead — for Gmail that is smtp.gmail.com:465 ` +
      "with an app password, which is allowed to send as your own address."
    );
  }

  if (PLACEHOLDER_SENDER_DOMAINS.includes(domain)) {
    return (
      `MAIL_FROM is "${configured}", which is a placeholder — ${domain} cannot send ` +
      "mail, so every message will be rejected with a domain-not-verified error.\n" +
      "    Fix: set MAIL_FROM to an address at a domain you have verified with your " +
      "relay provider."
    );
  }

  return null;
}

/* Called at boot so a sender that cannot possibly work is visible in the
 * startup log, rather than being discovered by the first person who tries to
 * sign up. Warns rather than refusing to boot: the rest of the product works
 * fine without outbound mail, and taking the API down over it would be a worse
 * failure than the one it is reporting. */
export function reportMailConfiguration(): void {
  const problem = senderConfigurationProblem();
  if (problem) {
    logger.error(`[mail] ${problem}`);
    return;
  }

  if (!isMailConfigured()) {
    logger.warn(
      "[mail] Neither SMTP_URL nor SMTP_HOST is set, so no email will be sent — " +
        "confirmation codes and reset links go to this log instead. Fine for local " +
        "work; set one before real users arrive.",
    );
    return;
  }

  logger.info(`[mail] smtp relay: ${smtpHost()}, sender: ${mailFrom()}`);
}

function smtpUser(): string {
  const url = process.env.SMTP_URL?.trim();
  if (url) {
    try {
      return decodeURIComponent(new URL(url).username);
    } catch {
      return "";
    }
  }

  return process.env.SMTP_USER?.trim() ?? "";
}

function mailFrom(): string {
  const configured = process.env.MAIL_FROM?.trim();

  /* No vendor sandbox to fall back on. The authenticating username is the one
   * honest guess available — on Gmail and most small relays it *is* the
   * mailbox being sent from — and anything else would be inventing an address
   * the relay has no reason to accept. senderConfigurationProblem says so at
   * boot when even that is unavailable. */
  if (!configured) {
    const user = smtpUser();
    return user.includes("@") ? `CanvasFlow <${user}>` : "";
  }

  /* Repeated here for the case where boot-time reporting was never reached —
   * a script importing this module directly, or a sender changed under a
   * running process. Once per process, so a send loop cannot flood the log. */
  if (!warnedAboutSender) {
    const problem = senderConfigurationProblem();
    if (problem) {
      warnedAboutSender = true;
      logger.error(`[mail] ${problem}`);
    }
  }

  return configured;
}

let warnedAboutLogTransport = false;

function deliverByLog(message: MailMessage): void {
  if (process.env.NODE_ENV === "production" && !warnedAboutLogTransport) {
    warnedAboutLogTransport = true;
    logger.error(
      "[mail] No SMTP relay is configured (SMTP_URL or SMTP_HOST), so no email " +
        "is being sent. " +
        "Password reset and address verification are non-functional for real users. " +
        "Message bodies — including reset links — are going to the log instead.",
    );
  }

  /* The link is the payload the developer actually needs, so log the text body
   * verbatim rather than a summary. */
  logger.warn(
    `[mail:log] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
  );
}

/* The transporter holds a connection pool, so it is built once and reused.
 * Rebuilding it per message would open a fresh TCP + TLS + AUTH handshake for
 * every signup, which relays treat as abusive. */
let smtpTransporter: unknown = null;

async function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter as { sendMail: (m: object) => Promise<unknown>; };

  /* Lazy: nodemailer is only loaded by deployments that actually use SMTP, so
   * the Resend and log paths keep their zero-dependency startup. */
  const nodemailer = (await import("nodemailer")).default;

  const url = process.env.SMTP_URL?.trim();

  /* Timeouts on all three phases. Without them a relay that accepts the
   * connection and then stalls holds the socket until the OS gives up, which
   * is minutes, and the request that triggered the send waits with it. */
  const timeouts = {
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    pool: true,
    maxConnections: 3,
  };

  smtpTransporter = url
    ? nodemailer.createTransport(url, timeouts)
    : nodemailer.createTransport({
        host: process.env.SMTP_HOST?.trim(),
        port: Number(process.env.SMTP_PORT ?? 587),
        /* Port 465 is implicit TLS; 587 starts plaintext and upgrades with
         * STARTTLS. Getting this backwards is the usual cause of a hang at
         * connect, so derive it from the port unless told otherwise. */
        secure: process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === "true"
          : Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: process.env.SMTP_USER?.trim()
          ? {
              user: process.env.SMTP_USER.trim(),
              pass: process.env.SMTP_PASSWORD ?? "",
            }
          : undefined,
        ...timeouts,
      });

  return smtpTransporter as { sendMail: (m: object) => Promise<unknown> };
}

async function deliverBySmtp(message: MailMessage): Promise<boolean> {
  try {
    const transporter = await getSmtpTransporter();

    await transporter.sendMail({
      from: mailFrom(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    return true;
  } catch (err) {
    /* Reset the pool: an auth failure or a dropped connection leaves the
     * cached transporter in a state where every later send fails the same way
     * until the process restarts. */
    smtpTransporter = null;
    logger.error(`[mail] smtp send failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/* Returns whether the message was handed to a provider.
 *
 * Never throws. Callers are auth endpoints whose correctness must not depend
 * on a third party being reachable — and in the case of forgot-password, must
 * not vary its response by whether delivery worked, because that would leak
 * which addresses are registered.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const template = message.template ?? "unknown";

  if (activeMailTransport() === "smtp") {
    const delivered = await deliverBySmtp(message);
    /* The distinction that matters operationally: `failed` means the relay
     * rejected it or was unreachable, which is invisible everywhere else —
     * sendMail deliberately never throws, so callers cannot tell. */
    recordMailSend(template, delivered ? "sent" : "failed");
    return delivered;
  }

  deliverByLog(message);
  /* Not a failure, but not delivery either: no relay is configured and the
   * body went to the log. In production that means nobody received it. */
  recordMailSend(template, "logged");
  return false;
}

/* ── Templates ─────────────────────────────────────────────────────────────
 *
 * Inline styles and a table-free single column, because that is what survives
 * Outlook and Gmail intact. Deliberately plain: a reset mail that looks like
 * marketing is a reset mail people distrust.
 */

function layout(heading: string, body: string, action?: { href: string; label: string }): string {
  const button = action
    ? `<p style="margin:28px 0;">
         <a href="${action.href}"
            style="display:inline-block;padding:12px 22px;background:#141c24;color:#ffffff;
                   text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
           ${action.label}
         </a>
       </p>
       <p style="margin:0 0 8px;font-size:13px;color:#5a6a78;">
         If the button does not work, paste this into your browser:
       </p>
       <p style="margin:0 0 24px;font-size:13px;word-break:break-all;">
         <a href="${action.href}" style="color:#0f6e70;">${action.href}</a>
       </p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f2f5f6;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
               color:#141c24;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;
                padding:32px;border:1px solid #d6dee2;">
      <p style="margin:0 0 20px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;
                color:#566775;font-weight:600;">CanvasFlow</p>
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;">${heading}</h1>
      ${body}
      ${button}
      <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #d6dee2;
                font-size:12px;color:#5a6a78;">
        If you did not request this, you can ignore this email — no changes have been made.
      </p>
    </div>
  </body>
</html>`;
}

export function passwordResetMail(to: string, link: string, ttlMinutes: number): MailMessage {
  return {
    template: "password_reset",
    to,
    subject: "Reset your CanvasFlow password",
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">
         Use the button below to choose a new password. The link expires in
         ${ttlMinutes} minutes and can be used once.
       </p>
       <p style="margin:0;font-size:15px;line-height:1.6;">
         Resetting your password signs you out everywhere else.
       </p>`,
      { href: link, label: "Choose a new password" },
    ),
    text: [
      "Reset your CanvasFlow password",
      "",
      `Open this link to choose a new password (expires in ${ttlMinutes} minutes, single use):`,
      link,
      "",
      "Resetting your password signs you out everywhere else.",
      "If you did not request this, ignore this email — no changes have been made.",
    ].join("\n"),
  };
}

/* The signup confirmation code.
 *
 * No link and no button, deliberately. This code completes a signup that is
 * already open in the sender's browser, so a link would open a second context
 * and there is nothing for it to usefully do. It also keeps the message immune
 * to the mail clients that rewrite or pre-fetch URLs.
 *
 * The code is repeated in the subject line because many clients show enough of
 * it in the notification to be typed without opening the message at all.
 */
export function signupCodeMail(to: string, code: string, ttlMinutes: number): MailMessage {
  return {
    template: "signup_code",
    to,
    subject: `${code} is your CanvasFlow confirmation code`,
    html: layout(
      "Confirm your email address",
      `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;">
         Enter this code to finish creating your CanvasFlow account:
       </p>
       <p style="margin:24px 0;font-family:ui-monospace,'SF Mono',Menlo,monospace;
                 font-size:34px;font-weight:700;letter-spacing:.22em;
                 color:#141c24;">${code}</p>
       <p style="margin:0;font-size:14px;line-height:1.6;color:#5a6a78;">
         The code expires in ${ttlMinutes} minutes. Your account is not created
         until it is entered, so if you did not start this, nothing exists to
         cancel — you can ignore this email.
       </p>`,
    ),
    text: [
      "Confirm your CanvasFlow email address",
      "",
      `Your confirmation code is: ${code}`,
      "",
      `It expires in ${ttlMinutes} minutes.`,
      "Your account is not created until the code is entered, so if you did not",
      "start this, there is nothing to cancel — ignore this email.",
    ].join("\n"),
  };
}

export function emailVerificationMail(to: string, link: string, ttlHours: number): MailMessage {
  return {
    template: "email_verification",
    to,
    subject: "Confirm your CanvasFlow email address",
    html: layout(
      "Confirm your email address",
      `<p style="margin:0;font-size:15px;line-height:1.6;">
         Confirming your address lets us reach you about your forms and
         presentations. The link expires in ${ttlHours} hours.
       </p>`,
      { href: link, label: "Confirm my email" },
    ),
    text: [
      "Confirm your CanvasFlow email address",
      "",
      `Open this link to confirm your address (expires in ${ttlHours} hours):`,
      link,
    ].join("\n"),
  };
}
