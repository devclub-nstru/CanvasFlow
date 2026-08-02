// Check form access permissions

export const SIGN_IN_REQUIRED_ERROR = "SIGN_IN_REQUIRED";
export const DOMAIN_NOT_ALLOWED_ERROR = "DOMAIN_NOT_ALLOWED";
export const ALREADY_RESPONDED_ERROR = "ALREADY_RESPONDED";

export interface FormAccessRules {
  requireSignIn: boolean;
  collectRespondentEmail: boolean;
  oneResponsePerRespondent: boolean;
  allowedEmailDomains?: string[] | null;
}

export function requiresSignIn(rules: FormAccessRules): boolean {
  return (
    rules.requireSignIn ||
    rules.collectRespondentEmail ||
    rules.oneResponsePerRespondent ||
    (rules.allowedEmailDomains?.length ?? 0) > 0
  );
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1
    ? ""
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

// Normalise domain name
export function normaliseDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .replace(/^\.+|\.+$/g, "");
}

// Check if email domain is allowed
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

export interface Respondent {
  id: string;
  email: string;
}

// Assert respondent is allowed
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
