import { beforeEach, describe, expect, it, vi } from "vitest";

/* Companion to mail.test.ts, which mocks nodemailer at the seam. This file
 * deliberately does NOT: it exercises the real lazy import and the real
 * failure path, which is the part that has to hold when a relay is wrong or
 * unreachable in production. */

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@repo/logger", () => ({ logger, default: logger }));

const { activeMailTransport, isMailConfigured, sendMail, senderConfigurationProblem } =
  await import("@repo/services/mail");

const message = { to: "user@example.com", subject: "s", html: "<p>h</p>", text: "t" };

beforeEach(() => {
  for (const key of ["SMTP_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "MAIL_FROM"]) {
    delete process.env[key];
  }
  vi.clearAllMocks();
});

describe("relay configuration", () => {
  it("selects smtp from either configuration style", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    expect(activeMailTransport()).toBe("smtp");
    expect(isMailConfigured()).toBe(true);

    delete process.env.SMTP_HOST;
    process.env.SMTP_URL = "smtp://u:p@smtp.example.com:587";
    expect(activeMailTransport()).toBe("smtp");
  });

  /* The distinction the sender check exists for. SES cannot send as
   * you@gmail.com — it has no authority over gmail.com — but smtp.gmail.com
   * can, and that is a normal way to run a small deployment. */
  it("allows a consumer sender only when the relay is that provider's own", () => {
    process.env.MAIL_FROM = "Me <me@gmail.com>";

    process.env.SMTP_HOST = "smtp.gmail.com";
    expect(senderConfigurationProblem()).toBeNull();

    process.env.SMTP_HOST = "email-smtp.eu-west-1.amazonaws.com";
    expect(senderConfigurationProblem()).toContain("personal mailbox provider");
  });

  it("flags a relay configured with no sender at all", () => {
    process.env.SMTP_HOST = "email-smtp.eu-west-1.amazonaws.com";
    expect(senderConfigurationProblem()).toContain("MAIL_FROM is not set");
  });

  /* Without a relay there is nothing to be wrong about — the log transport
   * needs no sender, and warning here would make every dev run noisy. */
  it("stays silent about an unset sender when no relay is configured", () => {
    expect(senderConfigurationProblem()).toBeNull();
  });
});

describe("delivery failures", () => {
  it("returns false instead of throwing when the relay is unreachable", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1";
    process.env.MAIL_FROM = "CanvasFlow <noreply@canvasflow.app>";

    await expect(sendMail(message)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("[mail] smtp send failed"));
  }, 20000);
});
