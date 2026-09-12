import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ACCEPTED_PPTX_MIME_TYPES,
  InvalidPptxError,
  assertIsPptx,
} from "../src/modules/presentation/pptxValidation.js";

/* The upload route cannot trust the browser's content type — a .pptx is
 * routinely reported as application/zip or octet-stream, so the accepted list
 * is wide and the real check is this one, on the bytes.
 *
 * Fixtures are written at run time rather than committed: every case is a few
 * bytes of header plus a marker, and building them here keeps what each one is
 * testing visible. */

const ZIP_LOCAL = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_EMPTY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const ZIP_SPANNED = Buffer.from([0x50, 0x4b, 0x07, 0x08]);

let dir;

/** Write a fixture whose bytes are `parts`, padded to at least 22 bytes. */
async function fixture(name, ...parts) {
  const body = Buffer.concat(parts.map((part) => (Buffer.isBuffer(part) ? part : Buffer.from(part, "latin1"))));
  const padded =
    body.length >= 22 ? body : Buffer.concat([body, Buffer.alloc(22 - body.length, 0x20)]);

  const file = path.join(dir, name);
  await fs.writeFile(file, padded);
  return file;
}

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "canvasflow-pptx-"));
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("assertIsPptx — a real presentation", () => {
  it("accepts a ZIP carrying both Office markers", async () => {
    const file = await fixture("ok.pptx", ZIP_LOCAL, "[Content_Types].xml", "ppt/slides/slide1.xml");
    await expect(assertIsPptx(file)).resolves.toBeUndefined();
  });

  it("finds the markers when they sit at the end of the archive", async () => {
    const file = await fixture(
      "tail.pptx",
      ZIP_LOCAL,
      Buffer.alloc(5_000, 0x41),
      "[Content_Types].xml",
      "ppt/presentation.xml",
    );
    await expect(assertIsPptx(file)).resolves.toBeUndefined();
  });
});

describe("assertIsPptx — not a ZIP at all", () => {
  it.each([
    ["a PDF", "%PDF-1.7"],
    ["a PNG", Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ["a RAR archive", "Rar!"],
    ["plain text", "just some notes about the deck"],
  ])("rejects %s renamed to .pptx", async (label, content) => {
    const file = await fixture(`${label.replace(/\W/g, "")}.pptx`, content);
    await expect(assertIsPptx(file)).rejects.toBeInstanceOf(InvalidPptxError);
    await expect(assertIsPptx(file)).rejects.toThrow(/not a PowerPoint presentation/);
  });

  it("says the name is irrelevant, since that is the confusing part", async () => {
    const file = await fixture("misleading.pptx", "%PDF-1.7");
    await expect(assertIsPptx(file)).rejects.toThrow(/regardless of its name/);
  });
});

describe("assertIsPptx — a ZIP that is not a presentation", () => {
  it("rejects an empty archive by its own header", async () => {
    const file = await fixture("empty.pptx", ZIP_EMPTY);
    await expect(assertIsPptx(file)).rejects.toThrow(/ZIP archive is empty/);
  });

  it("rejects a spanned archive", async () => {
    const file = await fixture("spanned.pptx", ZIP_SPANNED, "[Content_Types].xml", "ppt/");
    await expect(assertIsPptx(file)).rejects.toThrow(/not a PowerPoint presentation/);
  });

  it("rejects an ordinary ZIP with no Office parts", async () => {
    const file = await fixture("photos.pptx", ZIP_LOCAL, "holiday/IMG_0001.jpg");
    await expect(assertIsPptx(file)).rejects.toThrow(/not an Office document/);
  });

  it("rejects another Office format, naming what it actually is not", async () => {
    const file = await fixture("sheet.pptx", ZIP_LOCAL, "[Content_Types].xml", "xl/workbook.xml");
    await expect(assertIsPptx(file)).rejects.toThrow(
      /Office document but not a PowerPoint presentation/,
    );
  });
});

describe("assertIsPptx — unreadable input", () => {
  it("rejects a file that is too short to be an archive", async () => {
    const file = path.join(dir, "tiny.pptx");
    await fs.writeFile(file, ZIP_LOCAL);
    await expect(assertIsPptx(file)).rejects.toThrow(/empty or truncated/);
  });

  it("rejects a zero-byte file", async () => {
    const file = path.join(dir, "zero.pptx");
    await fs.writeFile(file, Buffer.alloc(0));
    await expect(assertIsPptx(file)).rejects.toThrow(/empty or truncated/);
  });

  it("rejects a path that does not exist, without throwing a system error", async () => {
    await expect(assertIsPptx(path.join(dir, "absent.pptx"))).rejects.toBeInstanceOf(
      InvalidPptxError,
    );
    await expect(assertIsPptx(path.join(dir, "absent.pptx"))).rejects.toThrow(/could not be read/);
  });

  it("rejects a directory", async () => {
    await expect(assertIsPptx(dir)).rejects.toThrow(/could not be read/);
  });
});

describe("InvalidPptxError", () => {
  it("is identifiable by name, so the route can map it to a 400", () => {
    const error = new InvalidPptxError("nope");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidPptxError");
    expect(error.message).toBe("nope");
  });
});

describe("ACCEPTED_PPTX_MIME_TYPES", () => {
  it.each([
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
    "",
  ])("accepts %j, because browsers report a .pptx inconsistently", (mimeType) => {
    expect(ACCEPTED_PPTX_MIME_TYPES.has(mimeType)).toBe(true);
  });

  it.each(["application/pdf", "image/png", "text/plain"])("rejects %s", (mimeType) => {
    expect(ACCEPTED_PPTX_MIME_TYPES.has(mimeType)).toBe(false);
  });

  it("is deliberately wide, which is why the byte check exists", () => {
    expect(ACCEPTED_PPTX_MIME_TYPES.has("application/octet-stream")).toBe(true);
  });
});
