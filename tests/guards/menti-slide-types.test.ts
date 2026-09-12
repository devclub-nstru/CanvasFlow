import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* Adding a Menti slide type means touching a handful of files that have no
 * type-level connection to each other: a TypeScript union in the browser, four
 * switch statements in the question registry, a Mongoose enum, a Zod list on
 * the server, and the picker the author chooses from.
 *
 * Miss one and nothing fails to compile — the slide simply renders as nothing,
 * or is rejected on save, for that one type. These tests read the sources and
 * make the separate lists agree, so a half-wired type fails here instead of in
 * front of an audience. */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative: string): string => fs.readFileSync(path.join(root, relative), "utf8");

const REGISTRY = "apps/web/components/menti/questions/registry.tsx";
const WEB_TYPES = "apps/web/lib/menti.ts";
const SLIDE_MODEL = "apps/menti/src/core/database/models/Slide.js";
const SERVER_SCHEMAS = "apps/menti/src/modules/presentation/presentation.schemas.js";
const PICKER = "apps/web/components/menti/builder/NewSlidePickerModal.tsx";

/** The union the browser treats as the set of slide types. */
function webUnion(): string[] {
  const source = read(WEB_TYPES);
  const declaration = /export type MentiQuestionType =([\s\S]*?);/.exec(source);
  expect(declaration, `MentiQuestionType is no longer declared in ${WEB_TYPES}`).not.toBeNull();
  return [...declaration![1]!.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]!);
}

/** A string array literal assigned to `name`, wherever it appears in `source`. */
function arrayLiteral(source: string, name: string): string[] {
  const declaration = new RegExp(`${name}\\s*:?=?\\s*\\[([^\\]]*)\\]`).exec(source);
  expect(declaration, `no array literal named ${name}`).not.toBeNull();
  return [...declaration![1]!.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]!);
}

/** The `case "X":` labels handled by each exported function in the registry. */
function registrySwitches(): Record<string, string[]> {
  const source = read(REGISTRY);
  const chunks = source.split(/export function /).slice(1);

  const byFunction: Record<string, string[]> = {};
  for (const chunk of chunks) {
    const name = /^([A-Za-z0-9_]+)/.exec(chunk)?.[1];
    if (!name) continue;
    byFunction[name] = [...chunk.matchAll(/case "([A-Z_]+)":/g)].map((m) => m[1]!);
  }
  return byFunction;
}

const types = webUnion();

describe("the slide type union", () => {
  it("is not empty, so the rest of these tests mean something", () => {
    expect(types.length).toBeGreaterThan(0);
  });

  it("has no duplicates", () => {
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("the question registry", () => {
  const switches = registrySwitches();

  it("still exports the four renderers a slide type needs", () => {
    expect(Object.keys(switches).sort()).toEqual([
      "SlideAudienceInput",
      "SlideQuestionCanvasEditor",
      "SlideQuestionEditor",
      "SlideQuestionViewer",
    ]);
  });

  it.each(Object.keys(registrySwitches()))("%s handles every slide type", (name) => {
    const handled = switches[name]!;
    const missing = types.filter((type) => !handled.includes(type));
    expect(missing, `${name} has no branch for: ${missing.join(", ")}`).toEqual([]);
  });

  it.each(Object.keys(registrySwitches()))("%s handles nothing that is not a slide type", (name) => {
    const unknown = switches[name]!.filter((type) => !types.includes(type));
    expect(unknown, `${name} branches on types that no longer exist: ${unknown.join(", ")}`).toEqual(
      [],
    );
  });
});

describe("the server's two independent tallies", () => {
  it("the Mongoose enum matches the browser's union", () => {
    expect(arrayLiteral(read(SLIDE_MODEL), "enum").sort()).toEqual([...types].sort());
  });

  it("the request schema matches the browser's union", () => {
    expect(arrayLiteral(read(SERVER_SCHEMAS), "slideTypes").sort()).toEqual([...types].sort());
  });

  it("and they match each other, which is the pair that actually drifts", () => {
    expect(arrayLiteral(read(SLIDE_MODEL), "enum").sort()).toEqual(
      arrayLiteral(read(SERVER_SCHEMAS), "slideTypes").sort(),
    );
  });
});

describe("the new-slide picker", () => {
  const picker = read(PICKER);
  const offered = [...picker.matchAll(/handleSelect\("([A-Z_]+)"\)/g)].map((m) => m[1]!);

  it("offers only real slide types", () => {
    const unknown = offered.filter((type) => !types.includes(type));
    expect(unknown, `the picker offers types that do not exist: ${unknown.join(", ")}`).toEqual([]);
  });

  it("offers every slide type an author can create", () => {
    /* LEADERBOARD is added by the product, not chosen from the picker, so it is
     * the one type allowed to be absent here. */
    const creatable = types.filter((type) => type !== "LEADERBOARD");
    const missing = creatable.filter((type) => !offered.includes(type));
    expect(missing, `the picker cannot create: ${missing.join(", ")}`).toEqual([]);
  });
});
