import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@repo/logger", () => ({ logger, default: logger }));

/* The relay itself is nodemailer's problem, not this module's. What is worth
 * asserting is the envelope handed to it and that a refusal comes back as
 * `false` rather than an exception, so the transport is mocked at the seam. */
const sendMailSpy = vi.fn().mockResolvedValue({ messageId: "1" });
/* Typed with its argument so `mock.calls[n][0]` is the transport options the
 * module built, rather than an empty tuple. */
const createTransport = vi.fn((_options: unknown) => ({ sendMail: sendMailSpy }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const {
  activeMailTransport,
  emailVerificationMail,
  isMailConfigured,
  passwordResetMail,
  sendMail,
  senderConfigurationProblem,
  signupCodeMail,
} = await import("@repo/services/mail");

/* The transporter is cached for the life of the process — deliberately, since
 * a fresh TLS + AUTH handshake per message is what relays throttle. A test
 * that asserts on how it was *built* therefore needs a module whose cache is
 * empty, rather than one primed by whichever test ran first. */
async function freshMail() {
  vi.resetModules();
  vi.clearAllMocks();
  return import("@repo/services/mail");
}

const snapshot = { ...process.env };

beforeEach(() => {
  for (const key of [
    "SMTP_URL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_SECURE",
    "MAIL_FROM",
  ]) {
    delete process.env[key];
  }
  vi.clearAllMocks();
  sendMailSpy.mockResolvedValue({ messageId: "1" });
});

afterEach(() => {
  process.env = { ...snapshot };
  vi.unstubAllGlobals();
});

/* ─── Transport selection ──────────────────────────────────────────────── */

describe("activeMailTransport", () => {
  it("logs instead of sending when no relay is configured", () => {
    expect(activeMailTransport()).toBe("log");
    expect(isMailConfigured()).toBe(false);
  });

  it("treats a blank host as unconfigured", () => {
    process.env.SMTP_HOST = "   ";
    expect(activeMailTransport()).toBe("log");
  });

  it("uses SMTP once a host is present", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    expect(activeMailTransport()).toBe("smtp");
    expect(isMailConfigured()).toBe(true);
  });

  it("accepts the single-URL form too", () => {
    process.env.SMTP_URL = "smtps://user:pass@smtp.example.com:465";
    expect(activeMailTransport()).toBe("smtp");
  });

  /* A typo'd URL must not look like a working relay, or the failure surfaces
   * as silently undelivered mail rather than as a configuration error. */
  it("falls back to the log when SMTP_URL is not a URL at all", () => {
    process.env.SMTP_URL = "smtp.example.com:587";
    expect(activeMailTransport()).toBe("log");
    expect(senderConfigurationProblem()).toContain("not a valid URL");
  });
});

/* ─── Sender validation ────────────────────────────────────────────────── */

describe("senderConfigurationProblem", () => {
  it("is silent when MAIL_FROM is unset, because the sandbox sender is used", () => {
    expect(senderConfigurationProblem()).toBeNull();
  });

  it("is silent for an address at a domain that could plausibly be verified", () => {
    process.env.MAIL_FROM = "CanvasFlow <noreply@canvasflow.app>";
    expect(senderConfigurationProblem()).toBeNull();
  });

  it("rejects an address with no domain part", () => {
    process.env.MAIL_FROM = "noreply";
    expect(senderConfigurationProblem()).toContain("has no domain part");
  });

  it.each([
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "icloud.com",
    "proton.me",
    "yandex.com",
  ])("rejects the consumer mailbox domain %s", (domain) => {
    process.env.MAIL_FROM = `noreply@${domain}`;
    const problem = senderConfigurationProblem();
    expect(problem).toContain("personal mailbox provider");
    expect(problem).toContain(domain);
  });

  it.each(["example.com", "example.org", "yourdomain.com", "localhost"])(
    "rejects the placeholder domain %s",
    (domain) => {
      process.env.MAIL_FROM = `noreply@${domain}`;
      expect(senderConfigurationProblem()).toContain("placeholder");
    },
  );

  it("reads the domain out of a display-name address", () => {
    process.env.MAIL_FROM = "CanvasFlow Team <noreply@gmail.com>";
    expect(senderConfigurationProblem()).toContain("personal mailbox provider");
  });

  it("ignores casing and padding", () => {
    process.env.MAIL_FROM = "  noreply@GMAIL.COM  ";
    expect(senderConfigurationProblem()).toContain("personal mailbox provider");
  });

  it("tells the reader how to fix it, not just that it is broken", () => {
    process.env.MAIL_FROM = "noreply@gmail.com";
    expect(senderConfigurationProblem()).toContain("Fix:");
  });
});

/* ─── Delivery ─────────────────────────────────────────────────────────── */

describe("sendMail", () => {
  const message = { to: "user@example.com", subject: "s", html: "<p>h</p>", text: "t" };

  it("reports failure and logs the body when no relay is configured", async () => {
    await expect(sendMail(message)).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("[mail:log]"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("user@example.com"));
  });

  it("hands the message to the relay and reports success", async () => {
    process.env.SMTP_HOST = "smtp.canvasflow.app";
    process.env.MAIL_FROM = "CanvasFlow <noreply@canvasflow.app>";

    await expect(sendMail(message)).resolves.toBe(true);

    const envelope = sendMailSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(envelope.to).toBe("user@example.com");
    expect(envelope.subject).toBe("s");
    expect(envelope.from).toBe("CanvasFlow <noreply@canvasflow.app>");
    expect(envelope.text).toBe("t");
    expect(envelope.html).toBe("<p>h</p>");
  });

  /* There is no vendor sandbox sender to fall back on, so the authenticating
   * account is the only address the relay is certain to accept. */
  it("falls back to the SMTP username as sender when MAIL_FROM is unset", async () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "me@gmail.com";

    await sendMail(message);

    const envelope = sendMailSpy.mock.calls[0]![0] as { from: string };
    expect(envelope.from).toBe("CanvasFlow <me@gmail.com>");
  });

  it("reads that fallback out of SMTP_URL credentials as well", async () => {
    process.env.SMTP_URL = "smtp://me%40gmail.com:app-password@smtp.gmail.com:587";

    await sendMail(message);

    const envelope = sendMailSpy.mock.calls[0]![0] as { from: string };
    expect(envelope.from).toBe("CanvasFlow <me@gmail.com>");
  });

  it("derives implicit TLS from port 465 and STARTTLS from 587", async () => {
    process.env.SMTP_HOST = "smtp.canvasflow.app";
    process.env.MAIL_FROM = "CanvasFlow <noreply@canvasflow.app>";

    process.env.SMTP_PORT = "465";
    await (await freshMail()).sendMail(message);
    expect((createTransport.mock.calls[0]![0] as { secure: boolean }).secure).toBe(true);

    process.env.SMTP_PORT = "587";
    await (await freshMail()).sendMail(message);
    expect((createTransport.mock.calls[0]![0] as { secure: boolean }).secure).toBe(false);
  });

  it("reports failure when the relay rejects the message", async () => {
    process.env.SMTP_HOST = "smtp.canvasflow.app";
    process.env.MAIL_FROM = "CanvasFlow <noreply@canvasflow.app>";
    sendMailSpy.mockRejectedValueOnce(new Error("550 sender not verified"));

    await expect(sendMail(message)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("550"));
  });

  /* Auth failures and dropped sockets poison a pooled transporter: every later
   * send fails the same way until the process restarts. The pool is therefore
   * rebuilt after a failure, which is what this asserts. */
  it("recovers on the next send after a failure", async () => {
    process.env.SMTP_HOST = "smtp.canvasflow.app";
    process.env.MAIL_FROM = "CanvasFlow <noreply@canvasflow.app>";
    const mail = await freshMail();
    sendMailSpy.mockRejectedValueOnce(new Error("EAUTH"));

    await expect(mail.sendMail(message)).resolves.toBe(false);
    await expect(mail.sendMail(message)).resolves.toBe(true);
    expect(createTransport).toHaveBeenCalledTimes(2);
  });

  it("gives the connection a deadline so a hung relay cannot hold the caller open", async () => {
    process.env.SMTP_HOST = "smtp.canvasflow.app";
    process.env.MAIL_FROM = "CanvasFlow <noreply@canvasflow.app>";

    await (await freshMail()).sendMail(message);

    const options = createTransport.mock.calls[0]![0] as Record<string, number>;
    expect(options.connectionTimeout).toBeGreaterThan(0);
    expect(options.greetingTimeout).toBeGreaterThan(0);
    expect(options.socketTimeout).toBeGreaterThan(0);
  });
});

/* ─── Templates ────────────────────────────────────────────────────────── */

describe("passwordResetMail", () => {
  const link = "https://app.canvasflow.test/reset?token=abc";
  const mail = passwordResetMail("user@example.com", link, 60);

  it("is addressed to the recipient with a subject that says what it is", () => {
    expect(mail.to).toBe("user@example.com");
    expect(mail.subject).toBe("Reset your CanvasFlow password");
  });

  it("carries the link in both the HTML and the plain text part", () => {
    expect(mail.html).toContain(link);
    expect(mail.text).toContain(link);
  });

  it("states the expiry and that the link is single use", () => {
    expect(mail.html).toContain("60 minutes");
    expect(mail.text).toContain("60 minutes");
    expect(mail.text).toContain("single use");
  });

  it("warns that resetting signs the account out elsewhere", () => {
    expect(mail.text).toContain("signs you out everywhere else");
  });

  it("ships a complete HTML document", () => {
    expect(mail.html.trimStart().startsWith("<!doctype html>")).toBe(true);
    expect(mail.html).toContain("</html>");
  });

  it("always includes a plain text part, which spam filters expect", () => {
    expect(mail.text.length).toBeGreaterThan(0);
    expect(mail.text).not.toContain("<p");
  });
});

describe("signupCodeMail", () => {
  const mail = signupCodeMail("user@example.com", "482913", 15);

  it("repeats the code in the subject, so it can be read from a notification", () => {
    expect(mail.subject).toBe("482913 is your CanvasFlow confirmation code");
  });

  it("shows the code in both parts", () => {
    expect(mail.html).toContain("482913");
    expect(mail.text).toContain("482913");
  });

  it("states the expiry", () => {
    expect(mail.html).toContain("15 minutes");
    expect(mail.text).toContain("15 minutes");
  });

  it("carries no link or button at all, by design", () => {
    expect(mail.html).not.toContain("<a href");
    expect(mail.text).not.toContain("http");
  });

  it("reassures the reader that no account exists yet", () => {
    expect(mail.text).toContain("not created until the code is entered");
  });
});

describe("emailVerificationMail", () => {
  const link = "https://app.canvasflow.test/verify?token=abc";
  const mail = emailVerificationMail("user@example.com", link, 24);

  it("is addressed and titled for confirmation", () => {
    expect(mail.to).toBe("user@example.com");
    expect(mail.subject).toBe("Confirm your CanvasFlow email address");
  });

  it("carries the link in both parts", () => {
    expect(mail.html).toContain(link);
    expect(mail.text).toContain(link);
  });

  it("states the expiry in hours", () => {
    expect(mail.html).toContain("24 hours");
    expect(mail.text).toContain("24 hours");
  });
});

describe("every template", () => {
  const built = [
    passwordResetMail("user@example.com", "https://x.test/a", 60),
    signupCodeMail("user@example.com", "123456", 15),
    emailVerificationMail("user@example.com", "https://x.test/b", 24),
  ];

  it.each(built.map((m) => [m.subject, m] as const))("%s is well formed", (_subject, mail) => {
    expect(mail.to).toBeTruthy();
    expect(mail.subject).toBeTruthy();
    expect(mail.html).toContain("CanvasFlow");
    expect(mail.text).toBeTruthy();
  });

  it.each(built.map((m) => [m.subject, m] as const))(
    "%s tells the reader they can ignore it",
    (_subject, mail) => {
      expect(`${mail.html}${mail.text}`.toLowerCase()).toContain("ignore this email");
    },
  );
});
