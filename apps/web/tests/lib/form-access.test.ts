import { describe, expect, it } from "vitest";
import {
  emailDomain,
  isEmailDomainAllowed,
  normaliseDomain,
  requiresSignIn,
} from "~/lib/form-access";
import {
  domainAllowedCases,
  emailDomainCases,
  normaliseDomainCases,
  requiresSignInCases,
} from "../../../../tests/fixtures/form-access-cases";

describe("requiresSignIn (browser copy)", () => {
  it.each(requiresSignInCases)("$name → $expected", ({ rules, expected }) => {
    expect(requiresSignIn(rules)).toBe(expected);
  });
});

describe("emailDomain (browser copy)", () => {
  it.each(emailDomainCases)("%j → %j", (input, expected) => {
    expect(emailDomain(input)).toBe(expected);
  });
});

describe("normaliseDomain (browser copy)", () => {
  it.each(normaliseDomainCases)("%j → %j", (input, expected) => {
    expect(normaliseDomain(input)).toBe(expected);
  });
});

describe("isEmailDomainAllowed (browser copy)", () => {
  it.each(domainAllowedCases)("$name", ({ email, allowed, expected }) => {
    expect(isEmailDomainAllowed(email, allowed)).toBe(expected);
  });
});
