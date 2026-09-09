import { logger } from "@repo/logger";

/* ── Outbound mail ─────────────────────────────────────────────────────────
 *
 * The product had no way to send email at all, which is why it had neither
 * address verification nor password reset. This is the smallest thing that
 * unblocks both without committing the project to a vendor.
 *
 * Two transports:
 *
 *   resend  Chosen as the default because it is a single HTTPS request, so it
 *           adds no dependency and nothing to audit. Set RESEND_API_KEY and
 *           MAIL_FROM to enable it.
 *
 *   log     The fallback when no provider is configured. It writes the message
 *           — including any link it contains — to the log instead of sending
 *           it, so local development works with no account anywhere and a
 *           misconfigured deployment is loud rather than silent.
 *
 * Swapping in SES, Postmark or SMTP means adding one branch to `deliver`. The
 * callers deal in `MailMessage` and never in a provider, deliberately.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /* Both are always provided. Plain text is not optional politeness: a
   * text/html-only message scores worse with spam filters, and password-reset
   * mail landing in spam is the failure mode that matters most here. */
  html: string;
  text: string;
}

export type MailTransport = "resend" | "log";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function activeMailTransport(): MailTransport {
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  return "log";
}

export function isMailConfigured(): boolean {
  return activeMailTransport() !== "log";
}

function mailFrom(): string {
  return process.env.MAIL_FROM?.trim() || "CanvasFlow <onboarding@resend.dev>";
}

let warnedAboutLogTransport = false;

function deliverByLog(message: MailMessage): void {
  if (process.env.NODE_ENV === "production" && !warnedAboutLogTransport) {
    warnedAboutLogTransport = true;
    logger.error(
      "[mail] RESEND_API_KEY is not set, so no email is being sent. " +
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

async function deliverByResend(message: MailMessage): Promise<boolean> {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      /* A hung provider must not hold a request open. The caller's own
       * response does not depend on delivery succeeding. */
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.error(`[mail] resend rejected the message (${response.status}): ${detail.slice(0, 300)}`);
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`[mail] resend request failed: ${err instanceof Error ? err.message : err}`);
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
  if (activeMailTransport() === "resend") return deliverByResend(message);

  deliverByLog(message);
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

export function emailVerificationMail(to: string, link: string, ttlHours: number): MailMessage {
  return {
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
