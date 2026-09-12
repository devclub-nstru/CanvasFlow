import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@repo/logger", () => ({ logger, default: logger }));

const {
  activeMailTransport,
  emailVerificationMail,
  isMailConfigured,
  passwordResetMail,
  sendMail,
  senderConfigurationProblem,
  signupCodeMail,
} = await import("@repo/services/mail");

const snapshot = { ...process.env };

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.MAIL_FROM;
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = { ...snapshot };
  vi.unstubAllGlobals();
});

/* ─── Transport selection ──────────────────────────────────────────────── */

describe("activeMailTransport", () => {
  it("logs instead of sending when no API key is configured", () => {
    expect(activeMailTransport()).toBe("log");
    expect(isMailConfigured()).toBe(false);
  });

  it("treats a blank API key as unconfigured", () => {
    process.env.RESEND_API_KEY = "   ";
    expect(activeMailTransport()).toBe("log");
  });

  it("uses Resend once an API key is present", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    expect(activeMailTransport()).toBe("resend");
    expect(isMailConfigured()).toBe(true);
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

  it("reports failure and logs the body when no provider is configured", async () => {
    await expect(sendMail(message)).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("[mail:log]"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("user@example.com"));
  });

  it("posts to Resend and reports success", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMail(message)).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.subject).toBe("s");
    expect(body.from).toBe("CanvasFlow <onboarding@resend.dev>");
  });

  it("uses the configured sender when there is one", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.MAIL_FROM = "CanvasFlow <noreply@canvasflow.app>";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await sendMail(message);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as {
      from: string;
    };
    expect(body.from).toBe("CanvasFlow <noreply@canvasflow.app>");
  });

  it("reports failure when the provider rejects the message", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("domain not verified"),
      }),
    );

    await expect(sendMail(message)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("403"));
  });

  it("never throws when the provider is unreachable", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(sendMail(message)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("ECONNREFUSED"));
  });

  it("gives the request a deadline so a hung provider cannot hold the caller open", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await sendMail(message);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
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
