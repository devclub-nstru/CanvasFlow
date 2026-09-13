/* Shared truth table for the form access rules.
 *
 * `apps/web/lib/form-access.ts` and
 * `packages/services/form-submission/access.ts` are two copies of the same
 * four functions: one gates the UI, the other gates the API. If they ever
 * disagree the browser will let a respondent start a form the server will
 * refuse to accept. Both suites run this table, so drift fails the build. */

export interface AccessRules {
  requireSignIn: boolean;
  collectRespondentEmail: boolean;
  oneResponsePerRespondent: boolean;
  allowedEmailDomains?: string[] | null;
}

const openForm: AccessRules = {
  requireSignIn: false,
  collectRespondentEmail: false,
  oneResponsePerRespondent: false,
  allowedEmailDomains: null,
};

export const requiresSignInCases: Array<{
  name: string;
  rules: AccessRules;
  expected: boolean;
}> = [
  { name: "a fully open form", rules: openForm, expected: false },
  {
    name: "an empty allow-list, which is not a restriction",
    rules: { ...openForm, allowedEmailDomains: [] },
    expected: false,
  },
  { name: "requireSignIn on its own", rules: { ...openForm, requireSignIn: true }, expected: true },
  {
    name: "collecting the respondent's email",
    rules: { ...openForm, collectRespondentEmail: true },
    expected: true,
  },
  {
    name: "limiting to one response per respondent",
    rules: { ...openForm, oneResponsePerRespondent: true },
    expected: true,
  },
  {
    name: "a non-empty domain allow-list",
    rules: { ...openForm, allowedEmailDomains: ["example.com"] },
    expected: true,
  },
  {
    name: "an undefined allow-list",
    rules: {
      requireSignIn: false,
      collectRespondentEmail: false,
      oneResponsePerRespondent: false,
    },
    expected: false,
  },
];

export const emailDomainCases: Array<[input: string, expected: string]> = [
  ["user@example.com", "example.com"],
  ["USER@EXAMPLE.COM", "example.com"],
  ["user@ example.com ", "example.com"],
  ["user+tag@mail.example.co.uk", "mail.example.co.uk"],
  /* Local parts may legitimately contain "@" when quoted, so the last one wins. */
  ["\"odd@local\"@example.com", "example.com"],
  ["not-an-email", ""],
  ["", ""],
  ["trailing@", ""],
];

export const normaliseDomainCases: Array<[input: string, expected: string]> = [
  ["Example.COM", "example.com"],
  ["  example.com  ", "example.com"],
  ["@example.com", "example.com"],
  ["https://example.com", "example.com"],
  ["http://example.com/path/here", "example.com"],
  ["example.com/", "example.com"],
  [".example.com.", "example.com"],
  ["...example.com...", "example.com"],
  ["", ""],
  ["   ", ""],
];

export const domainAllowedCases: Array<{
  name: string;
  email: string;
  allowed: string[] | null | undefined;
  expected: boolean;
}> = [
  {
    name: "no allow-list lets anyone in",
    email: "user@anywhere.test",
    allowed: null,
    expected: true,
  },
  {
    name: "an undefined allow-list lets anyone in",
    email: "user@anywhere.test",
    allowed: undefined,
    expected: true,
  },
  {
    name: "an empty allow-list lets anyone in",
    email: "user@anywhere.test",
    allowed: [],
    expected: true,
  },
  {
    name: "an exact domain match",
    email: "user@example.com",
    allowed: ["example.com"],
    expected: true,
  },
  {
    name: "a case-insensitive match",
    email: "USER@Example.COM",
    allowed: ["EXAMPLE.com"],
    expected: true,
  },
  {
    name: "a subdomain of an allowed domain",
    email: "user@mail.example.com",
    allowed: ["example.com"],
    expected: true,
  },
  {
    name: "a look-alike suffix that is not a subdomain",
    email: "user@notexample.com",
    allowed: ["example.com"],
    expected: false,
  },
  {
    name: "a parent of an allowed subdomain",
    email: "user@example.com",
    allowed: ["mail.example.com"],
    expected: false,
  },
  {
    name: "an allow-list entry written as a URL",
    email: "user@example.com",
    allowed: ["https://example.com/"],
    expected: true,
  },
  {
    name: "an allow-list entry written with a leading @",
    email: "user@example.com",
    allowed: ["@example.com"],
    expected: true,
  },
  {
    name: "one match among several entries",
    email: "user@second.test",
    allowed: ["first.test", "second.test"],
    expected: true,
  },
  {
    name: "a blank allow-list entry, which matches nothing",
    email: "user@example.com",
    allowed: ["  "],
    expected: false,
  },
  {
    name: "an address with no domain at all",
    email: "not-an-email",
    allowed: ["example.com"],
    expected: false,
  },
  {
    name: "an address whose domain is not on the list",
    email: "user@elsewhere.test",
    allowed: ["example.com"],
    expected: false,
  },
];
