/* Regression tests for the public form read rule (finding 14).
 *
 * Run as part of: pnpm --filter @repo/api test
 *
 * The bug: getFormById is a public procedure and its service checked only
 * isArchived, never isPublished. Anyone holding a form id could read an
 * unpublished draft in full — every field, segment and logic rule.
 *
 * The rule is now one pure function, which is what these assertions pin. The
 * awkward part of this fix is that "reject drafts" is too strong: the builder
 * previews an unpublished form through this same public path, so editors have
 * to keep getting through. Both halves are covered below.
 */

process.env.NODE_ENV = "production";
process.env.REDIS_URL = "";
process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5999/nope";

const { canReadFormBundle } = await import(
  "/Users/dittyamaity/Desktop/CanvasFlow/packages/services/form/index.ts"
);

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

const draft = { isArchived: false, isPublished: false };
const published = { isArchived: false, isPublished: true };
const archived = { isArchived: true, isPublished: true };
const archivedDraft = { isArchived: true, isPublished: false };

console.log("\n#14 Public form read rule\n");

console.log(" [the vulnerability: a draft must not be readable by the public]");
check("anonymous cannot read a draft", canReadFormBundle(draft, null), false);
check("a signed-in stranger cannot read a draft", canReadFormBundle(draft, null), false);
check("a viewer collaborator cannot read a draft", canReadFormBundle(draft, "viewer"), false);

console.log(" [but the builder's own preview must keep working]");
check("the owner can read their draft", canReadFormBundle(draft, "owner"), true);
check("an editor can read the draft", canReadFormBundle(draft, "editor"), true);

console.log("\n [a published form stays public — that is the product]");
check("anonymous can read a published form", canReadFormBundle(published, null), true);
check("a viewer can read a published form", canReadFormBundle(published, "viewer"), true);
check("the owner can read a published form", canReadFormBundle(published, "owner"), true);

console.log("\n [archived beats everything, including ownership]");
check("anonymous cannot read an archived form", canReadFormBundle(archived, null), false);
check("a viewer cannot read an archived form", canReadFormBundle(archived, "viewer"), false);
check("an editor cannot read an archived form", canReadFormBundle(archived, "editor"), false);
check("even the owner cannot read an archived form", canReadFormBundle(archived, "owner"), false);
check(
  "archived and unpublished is still closed to the owner",
  canReadFormBundle(archivedDraft, "owner"),
  false,
);

console.log("\n [no state grants more than the published case]");
/* Exhaustive over the four state/role combinations that matter, so a future
 * edit cannot widen access without a failing assertion. */
const roles = [null, "viewer", "editor", "owner"] as const;
const states = [
  ["draft", draft, [false, false, true, true]],
  ["published", published, [true, true, true, true]],
  ["archived", archived, [false, false, false, false]],
] as const;

for (const [label, form, expected] of states) {
  const actual = roles.map((r) => canReadFormBundle(form, r));
  check(
    `${label}: [${roles.map((r) => r ?? "anon").join(", ")}]`,
    JSON.stringify(actual),
    JSON.stringify(expected),
  );
}

console.log(`\n${"─".repeat(52)}`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
