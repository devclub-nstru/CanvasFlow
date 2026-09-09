import fs from "node:fs/promises";

const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const ZIP_EMPTY_HEADER = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const ZIP_SPANNED_HEADER = Buffer.from([0x50, 0x4b, 0x07, 0x08]);

const WINDOW_BYTES = 1024 * 1024;

const CONTENT_TYPES_MARKER = Buffer.from("[Content_Types].xml", "latin1");
const PPT_SUBTREE_MARKER = Buffer.from("ppt/", "latin1");

export class InvalidPptxError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidPptxError";
  }
}

async function readWindow(handle, position, length, fileSize) {
  const start = Math.max(0, Math.min(position, fileSize));
  const size = Math.max(0, Math.min(length, fileSize - start));
  if (size === 0) return Buffer.alloc(0);

  const buf = Buffer.alloc(size);
  await handle.read(buf, 0, size, start);
  return buf;
}

export async function assertIsPptx(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);

  if (!stat || !stat.isFile()) {
    throw new InvalidPptxError("The uploaded file could not be read");
  }

  if (stat.size < 22) {
    throw new InvalidPptxError("That file is empty or truncated");
  }

  const handle = await fs.open(filePath, "r");

  try {
    const head = await readWindow(handle, 0, WINDOW_BYTES, stat.size);
    const magic = head.subarray(0, 4);

    if (magic.equals(ZIP_EMPTY_HEADER)) {
      throw new InvalidPptxError("That ZIP archive is empty");
    }

    if (magic.equals(ZIP_SPANNED_HEADER) || !magic.equals(ZIP_LOCAL_HEADER)) {
      throw new InvalidPptxError(
        "That file is not a PowerPoint presentation — a .pptx is a ZIP package, " +
          "and this file's contents are something else regardless of its name",
      );
    }

    const tail = await readWindow(
      handle,
      stat.size - WINDOW_BYTES,
      WINDOW_BYTES,
      stat.size,
    );

    const hasContentTypes =
      head.includes(CONTENT_TYPES_MARKER) || tail.includes(CONTENT_TYPES_MARKER);

    if (!hasContentTypes) {
      throw new InvalidPptxError(
        "That file is a ZIP archive but not an Office document",
      );
    }

    const hasPptSubtree =
      head.includes(PPT_SUBTREE_MARKER) || tail.includes(PPT_SUBTREE_MARKER);

    if (!hasPptSubtree) {
      throw new InvalidPptxError(
        "That looks like an Office document but not a PowerPoint presentation",
      );
    }
  } finally {
    await handle.close().catch(() => {});
  }
}

export const ACCEPTED_PPTX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "",
]);
