/* Tests for the mail layer added with finding 22.
 *
 * Run as part of: pnpm --filter @repo/api test
 *
 * The reset and verification flows themselves need Postgres, so what is
 * covered here is the part that can be verified hermetically and is easy to
 * get quietly wrong: the transport selection, the fail-safe behaviour when no
 * provider is configured, and the message bodies actually carrying the link.
 * A reset email that renders without its link is a support ticket, not a
 * crash, so nothing else would catch it.
 */

process.env.NODE_ENV = "test";
delete process.env.RESEND_API_KEY;

const MAIL = "/Users/dittyamaity/Desktop/CanvasFlow/packages/services/mail/index.ts";
const {
  sendMail,
  passwordResetMail,
  emailVerificationMail,
  isMailConfigured,
  activeMailTransport,
} = await import(MAIL);

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}\n         got:      ${actual}\n         expected: ${expected}`);
  }
}

const LINK = "https://app.canvasflow.test/resetPassword?token=abc.def-ghi_jkl";

console.log("\n#22 Mail transport selection\n");
check("no API key means the log transport", activeMailTransport(), "log");
check("and reports itself as unconfigured", isMailConfigured(), false);

process.env.RESEND_API_KEY = "re_test_key";
check("an API key selects resend", activeMailTransport(), "resend");
check("and reports itself as configured", isMailConfigured(), true);
delete process.env.RESEND_API_KEY;

/* Whitespace-only must not count as configured, or a deployment with
 * RESEND_API_KEY="" would silently think it can send mail. */
process.env.RESEND_API_KEY = "   ";
check("a blank API key does not count as configured", activeMailTransport(), "log");
delete process.env.RESEND_API_KEY;

console.log("\n [sendMail must never throw, and must report honestly]");
const delivered = await sendMail({
  to: "someone@example.com",
  subject: "Test",
  html: "<p>x</p>",
  text: "x",
}).catch(() => "THREW");
check("unconfigured send does not throw", delivered === "THREW", false);
check("unconfigured send reports not-delivered", delivered, false);

console.log("\n#22 Password reset message\n");
const reset = passwordResetMail("someone@example.com", LINK, 60);
check("addressed to the recipient", reset.to, "someone@example.com");
check("has a subject", reset.subject.length > 0, true);
check("html carries the link", reset.html.includes(LINK), true);
check("text carries the link", reset.text.includes(LINK), true);
/* A text/html-only message scores worse with spam filters, and reset mail in
 * the spam folder is the failure that matters most here. */
check("has a non-empty plain-text alternative", reset.text.trim().length > 0, true);
check("states the expiry", reset.text.includes("60"), true);
check("warns that other sessions end", reset.text.toLowerCase().includes("signs you out"), true);
check(
  "tells an unintended recipient nothing has changed",
  reset.text.toLowerCase().includes("did not request"),
  true,
);

console.log("\n#22 Verification message\n");
const verify = emailVerificationMail("someone@example.com", LINK, 24);
check("addressed to the recipient", verify.to, "someone@example.com");
check("html carries the link", verify.html.includes(LINK), true);
check("text carries the link", verify.text.includes(LINK), true);
check("has a non-empty plain-text alternative", verify.text.trim().length > 0, true);
check("states the expiry", verify.text.includes("24"), true);

console.log("\n [links must survive being placed in HTML]");
/* base64url tokens contain - and _ but never & or <, so the link must appear
 * byte-for-byte. If a template ever HTML-escapes it, the link breaks silently
 * for every user. */
check("reset link is not mangled", reset.html.split(LINK).length - 1 >= 1, true);
check(
  "reset link appears in both the button and the fallback text",
  reset.html.split(LINK).length - 1 >= 2,
  true,
);

console.log(`\n${"─".repeat(52)}`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
