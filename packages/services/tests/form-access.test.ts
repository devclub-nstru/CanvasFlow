import { describe, expect, it } from "vitest";
import {
  ALREADY_RESPONDED_ERROR,
  DOMAIN_NOT_ALLOWED_ERROR,
  SIGN_IN_REQUIRED_ERROR,
  assertRespondentAllowed,
  emailDomain,
  isEmailDomainAllowed,
  normaliseDomain,
  requiresSignIn,
} from "../form-submission/access";
import {
  domainAllowedCases,
  emailDomainCases,
  normaliseDomainCases,
  requiresSignInCases,
} from "../../../tests/fixtures/form-access-cases";

describe("requiresSignIn (server copy)", () => {
  it.each(requiresSignInCases)("$name → $expected", ({ rules, expected }) => {
    expect(requiresSignIn(rules)).toBe(expected);
  });
});

describe("emailDomain (server copy)", () => {
  it.each(emailDomainCases)("%j → %j", (input, expected) => {
    expect(emailDomain(input)).toBe(expected);
  });
});

describe("normaliseDomain (server copy)", () => {
  it.each(normaliseDomainCases)("%j → %j", (input, expected) => {
    expect(normaliseDomain(input)).toBe(expected);
  });
});

describe("isEmailDomainAllowed (server copy)", () => {
  it.each(domainAllowedCases)("$name", ({ email, allowed, expected }) => {
    expect(isEmailDomainAllowed(email, allowed)).toBe(expected);
  });
});

describe("error codes", () => {
  it("are stable strings the tRPC layer maps to user-facing messages", () => {
    expect(SIGN_IN_REQUIRED_ERROR).toBe("SIGN_IN_REQUIRED");
    expect(DOMAIN_NOT_ALLOWED_ERROR).toBe("DOMAIN_NOT_ALLOWED");
    expect(ALREADY_RESPONDED_ERROR).toBe("ALREADY_RESPONDED");
  });
});

describe("assertRespondentAllowed", () => {
  const open = {
    requireSignIn: false,
    collectRespondentEmail: false,
    oneResponsePerRespondent: false,
    allowedEmailDomains: null,
  };

  it("lets an anonymous respondent through an open form", () => {
    expect(() => assertRespondentAllowed(open, null)).not.toThrow();
  });

  it("demands sign-in when any rule requires identity", () => {
    expect(() => assertRespondentAllowed({ ...open, requireSignIn: true }, null)).toThrow(
      SIGN_IN_REQUIRED_ERROR,
    );
  });

  it("accepts a respondent on an allowed domain", () => {
    expect(() =>
      assertRespondentAllowed(
        { ...open, allowedEmailDomains: ["example.com"] },
        { id: "u1", email: "user@example.com" },
      ),
    ).not.toThrow();
  });

  it("rejects a respondent on a domain that is not allowed", () => {
    expect(() =>
      assertRespondentAllowed(
        { ...open, allowedEmailDomains: ["example.com"] },
        { id: "u1", email: "user@elsewhere.test" },
      ),
    ).toThrow(DOMAIN_NOT_ALLOWED_ERROR);
  });

  it("does not check the domain when the form has no allow-list", () => {
    expect(() =>
      assertRespondentAllowed({ ...open, requireSignIn: true }, {
        id: "u1",
        email: "user@anywhere.test",
      }),
    ).not.toThrow();
  });

  it("skips every check when the form asks for nothing, even without a respondent", () => {
    expect(() => assertRespondentAllowed(open, null)).not.toThrow();
  });
});
