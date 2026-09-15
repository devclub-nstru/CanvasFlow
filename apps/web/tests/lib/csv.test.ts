import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildResponsesCsv,
  downloadCsv,
  escapeCsvCell,
  formatCsvValue,
  responsesCsvFilename,
  type CsvField,
  type CsvSubmission,
} from "~/lib/csv";


function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += ch;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

const FIELDS: CsvField[] = [
  { id: "f1", label: "Your name", type: "TEXT" },
  { id: "f2", label: "Toppings", type: "CHECKBOX" },
];

function submission(overrides: Partial<CsvSubmission> = {}): CsvSubmission {
  return {
    id: "sub-1",
    createdAt: "2026-09-15T10:30:00.000Z",
    respondentEmail: "a@example.com",
    deviceType: "mobile",
    values: [{ formFieldId: "f1", value: "Ada" }],
    ...overrides,
  };
}

/* ─── escapeCsvCell ────────────────────────────────────────────────────── */

describe("escapeCsvCell", () => {
  it("leaves a plain value alone", () => {
    expect(escapeCsvCell("Ada")).toBe("Ada");
  });

  it("quotes a value containing a comma", () => {
    expect(escapeCsvCell("Lovelace, Ada")).toBe('"Lovelace, Ada"');
  });

  it("doubles an embedded quote and wraps the cell", () => {
    expect(escapeCsvCell('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(escapeCsvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("defuses a value a spreadsheet would run as a formula", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("+1-800-CALL")).toBe("'+1-800-CALL");
  });

  it("leaves a negative number as a number", () => {
    expect(escapeCsvCell("-12")).toBe("-12");
    expect(escapeCsvCell("-12.5")).toBe("-12.5");
  });

  it("still defuses a minus sign that starts something other than a number", () => {
    expect(escapeCsvCell("-1+cmd")).toBe("'-1+cmd");
  });
});

/* ─── formatCsvValue ───────────────────────────────────────────────────── */

describe("formatCsvValue", () => {
  it("renders a missing answer as empty", () => {
    expect(formatCsvValue(undefined)).toBe("");
    expect(formatCsvValue(null)).toBe("");
  });

  it("joins a multi-select answer", () => {
    expect(formatCsvValue(["Olives", "Basil"])).toBe("Olives, Basil");
  });

  it("writes booleans as words rather than true/false", () => {
    expect(formatCsvValue(true)).toBe("Yes");
    expect(formatCsvValue(false)).toBe("No");
  });

  it("keeps a zero, which is not the same as no answer", () => {
    expect(formatCsvValue(0)).toBe("0");
  });

  it("names an uploaded file instead of dumping its JSON", () => {
    const value = [{ originalName: "cv.pdf", url: "https://cdn.example/cv.pdf" }];
    expect(formatCsvValue(value, "FILE_UPLOAD")).toBe("cv.pdf (https://cdn.example/cv.pdf)");
  });

  it("handles an upload stored as a bare url", () => {
    expect(formatCsvValue("https://cdn.example/a.png", "FILE_UPLOAD")).toBe(
      "https://cdn.example/a.png",
    );
  });

  it("falls back to JSON for a shape it does not recognise", () => {
    expect(formatCsvValue({ lat: 1, lng: 2 })).toBe('{"lat":1,"lng":2}');
  });
});

/* ─── buildResponsesCsv ────────────────────────────────────────────────── */

describe("buildResponsesCsv", () => {
  it("puts the metadata columns before the questions", () => {
    const [header] = parseCsv(buildResponsesCsv(FIELDS, [submission()]));

    expect(header).toEqual([
      "Submission ID",
      "Submitted At",
      "Respondent Email",
      "Device Type",
      "Your name",
      "Toppings",
    ]);
  });

  it("keeps the columns aligned when a question label contains a comma", () => {
    const fields: CsvField[] = [{ id: "f1", label: "Name, in full", type: "TEXT" }];
    const rows = parseCsv(buildResponsesCsv(fields, [submission()]));

    expect(rows[0]).toEqual([...rows[0]!.slice(0, 4), "Name, in full"]);
    expect(rows[1]).toHaveLength(rows[0]!.length);
  });

  it("keeps the columns aligned when an answer contains a comma, quote or newline", () => {
    const messy = submission({
      values: [{ formFieldId: "f1", value: 'Ada, "the"\nfirst' }],
    });
    const rows = parseCsv(buildResponsesCsv(FIELDS, [messy]));

    expect(rows[1]).toHaveLength(6);
    expect(rows[1]![4]).toBe('Ada, "the"\nfirst');
  });

  it("writes the timestamp as ISO 8601, which carries no comma", () => {
    const rows = parseCsv(buildResponsesCsv(FIELDS, [submission()]));
    expect(rows[1]![1]).toBe("2026-09-15T10:30:00.000Z");
  });

  it("accepts a Date as well as a string", () => {
    const rows = parseCsv(
      buildResponsesCsv(FIELDS, [submission({ createdAt: new Date("2026-01-02T03:04:05Z") })]),
    );
    expect(rows[1]![1]).toBe("2026-01-02T03:04:05.000Z");
  });

  it("leaves an unanswered question blank rather than skipping the column", () => {
    const rows = parseCsv(buildResponsesCsv(FIELDS, [submission()]));

    expect(rows[1]).toHaveLength(6);
    expect(rows[1]![5]).toBe("");
  });

  it("labels an anonymous respondent", () => {
    const rows = parseCsv(
      buildResponsesCsv(FIELDS, [submission({ respondentEmail: null, deviceType: null })]),
    );

    expect(rows[1]![2]).toBe("Anonymous");
    expect(rows[1]![3]).toBe("Unknown");
  });

  it("survives a submission with no values at all", () => {
    const rows = parseCsv(buildResponsesCsv(FIELDS, [submission({ values: null })]));
    expect(rows[1]).toHaveLength(6);
  });

  it("emits a header row on its own when there are no submissions", () => {
    expect(parseCsv(buildResponsesCsv(FIELDS, []))).toHaveLength(1);
  });

  it("separates rows with CRLF", () => {
    const csv = buildResponsesCsv(FIELDS, [submission(), submission({ id: "sub-2" })]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});

/* ─── responsesCsvFilename ─────────────────────────────────────────────── */

describe("responsesCsvFilename", () => {
  const day = new Date("2026-09-15T10:00:00Z");

  it("slugs the form title and dates the file", () => {
    expect(responsesCsvFilename("Onboarding Survey", day)).toBe(
      "onboarding-survey-responses-2026-09-15.csv",
    );
  });

  it("strips punctuation that has no business in a filename", () => {
    expect(responsesCsvFilename('Q4: "Feedback"/2026', day)).toBe(
      "q4-feedback-2026-responses-2026-09-15.csv",
    );
  });

  it("falls back when the title is missing or unusable", () => {
    expect(responsesCsvFilename(undefined, day)).toBe("form-responses-2026-09-15.csv");
    expect(responsesCsvFilename("!!!", day)).toBe("form-responses-2026-09-15.csv");
  });
});

/* ─── downloadCsv ──────────────────────────────────────────────────────── */

describe("downloadCsv", () => {
  const objectUrlApi = {
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
  };

  afterEach(() => {
    URL.createObjectURL = objectUrlApi.create;
    URL.revokeObjectURL = objectUrlApi.revoke;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function captureDownload(csv: string) {
    const blobs: Blob[] = [];
    const created: string[] = [];
    const revoked: string[] = [];

    /* jsdom implements neither, so these are assigned rather than spied on and
     * put back by the afterEach below. */
    URL.createObjectURL = (blob: Blob) => {
      blobs.push(blob);
      const url = `blob:fake-${created.length}`;
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    const clicked: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") {
        vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {
          clicked.push(el as HTMLAnchorElement);
        });
      }
      return el;
    });

    downloadCsv("responses.csv", csv);

    return { blobs, created, revoked, clicked };
  }

  it("clicks a link carrying the filename", () => {
    const { clicked } = captureDownload("a,b");

    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toBe("responses.csv");
    expect(clicked[0]!.href).toBe("blob:fake-0");
  });

  it("leaves no link behind in the document", () => {
    captureDownload("a,b");
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("prefixes the file with a BOM, or Excel mangles every accent", async () => {
    const { blobs } = captureDownload("café,naïve");

    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.type).toBe("text/csv;charset=utf-8;");

    /* Asserted on the bytes: a decoder swallows the BOM on the way back out,
     * so reading the blob as text would pass with or without it. */
    const bytes = new Uint8Array(await blobs[0]!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("revokes the object url rather than leaking it for the life of the tab", () => {
    vi.useFakeTimers();
    const { created, revoked } = captureDownload("a,b");

    expect(revoked, "revoking immediately can cancel the download").toEqual([]);
    vi.runAllTimers();
    expect(revoked).toEqual(created);
  });
});
