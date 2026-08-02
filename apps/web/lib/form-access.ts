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

export function normaliseDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .replace(/^\.+|\.+$/g, "");
}

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
