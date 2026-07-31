/**
 * Who is allowed to answer a form.
 *
 * Separated from the submit path so the same rules can answer two different
 * questions with one implementation: "may this person submit?" (enforced) and
 * "what should we tell them before they start?" (the public form's gate). A
 * second copy of the domain matching in the UI is how a respondent ends up
 * being told they're allowed and then rejected.
 */

/** Sentinels the public form matches on to pick a screen. Kept stable. */
export const SIGN_IN_REQUIRED_ERROR = "SIGN_IN_REQUIRED";
export const DOMAIN_NOT_ALLOWED_ERROR = "DOMAIN_NOT_ALLOWED";
export const ALREADY_RESPONDED_ERROR = "ALREADY_RESPONDED";

/** The access-controlling settings, as stored on the form. */
export interface FormAccessRules {
  requireSignIn: boolean;
  collectRespondentEmail: boolean;
  oneResponsePerRespondent: boolean;
  allowedEmailDomains?: string[] | null;
}

/**
 * Does the form need a signed-in respondent?
 *
 * The three dependent settings each imply it, and this is the single place that
 * says so. An editor who ticks "collect email" without ticking "require sign
 * in" gets the requirement anyway rather than a setting that silently does
 * nothing — there is no way to read an account's email without an account.
 */
export function requiresSignIn(rules: FormAccessRules): boolean {
  return (
    rules.requireSignIn ||
    rules.collectRespondentEmail ||
    rules.oneResponsePerRespondent ||
    (rules.allowedEmailDomains?.length ?? 0) > 0
  );
}

/** `dittya@nst.rishihood.edu.in` -> `nst.rishihood.edu.in` */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

/**
 * Normalise an author-supplied domain. Accepts what people actually type —
 * `@example.com`, `https://example.com`, `Example.COM ` — because rejecting
 * those would just mean a restriction that silently matches nothing.
 */
export function normaliseDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Is this email inside one of the allowed domains?
 *
 * Suffix matching, deliberately: an entry of `rishihood.edu.in` admits both
 * `kamlesh@rishihood.edu.in` and `dittya@nst.rishihood.edu.in`, because a
 * university that hands out per-department subdomains is still one institution
 * and the author should not have to enumerate them.
 *
 * The boundary check is what keeps that from being too loose. Matching on a
 * bare `endsWith` would also admit `evil-rishihood.edu.in`, so a longer domain
 * only matches when the extra part ends at a dot.
 */
export function isEmailDomainAllowed(email: string, allowed?: string[] | null): boolean {
  if (!allowed || allowed.length === 0) return true;

  const domain = emailDomain(email);
  if (!domain) return false;

  return allowed.some((entry) => {
    const candidate = normaliseDomain(entry);
    if (!candidate) return false;
    return domain === candidate || domain.endsWith(`.${candidate}`);
  });
}

/** The respondent, as far as the server is concerned. Email comes from the
 *  session — never from the request body, or the domain rule would be a
 *  suggestion. */
export interface Respondent {
  id: string;
  email: string;
}

/**
 * Check a respondent against a form's rules. Throws one of the sentinels above,
 * or returns cleanly.
 */
export function assertRespondentAllowed(
  rules: FormAccessRules,
  respondent: Respondent | null,
): void {
  if (!requiresSignIn(rules)) return;

  if (!respondent) throw new Error(SIGN_IN_REQUIRED_ERROR);

  if (!isEmailDomainAllowed(respondent.email, rules.allowedEmailDomains)) {
    throw new Error(DOMAIN_NOT_ALLOWED_ERROR);
  }
}
