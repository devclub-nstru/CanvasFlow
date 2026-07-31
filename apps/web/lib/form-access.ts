/**
 * Who is allowed to answer a form — the respondent's side of it.
 *
 * A deliberate mirror of `packages/services/form-submission/access.ts`, which
 * remains the enforcing copy. This exists because the public form has to answer
 * a question *before* anyone submits: "should this person be shown the form, or
 * a sign-in wall, or a wrong-domain notice?" Asking somebody fifty questions
 * and only then telling them to sign in wastes their time and loses their
 * answers.
 *
 * It's duplicated rather than imported because `apps/web` depends on
 * `@repo/trpc` alone; the services package is server-side and pulls in the
 * database client, which has no business in a browser bundle. Same reasoning
 * and same shape as `form-flow.ts` and `form-logic.ts`.
 *
 * Only the pure predicates live here. `assertRespondentAllowed` stays on the
 * server, because a gate the client can compute is a hint, not a rule — these
 * functions decide what to *show*, never what to *allow*. If the two ever
 * disagree the server wins and the respondent sees the matching error screen.
 */

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
 * The three dependent settings each imply it. Recording an email, holding
 * someone to one response, and restricting by domain are all impossible without
 * an account to read, so any of them turns the requirement on whether or not
 * the author ticked it.
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
