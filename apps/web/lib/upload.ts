import { env } from "~/env.js";

export interface UploadedFileRef {
  uploadId: string;
  claimToken: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: "pending" | "processing" | "ready" | "failed";
  url: string | null;
  error: string | null;
}

export function apiOrigin(): string {
  const raw = env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return raw.replace(/\/$/, "").replace(/\/trpc$/, "");
}

export class UploadError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

interface StartUploadOptions {
  formId: string;
  fieldId: string;
  file: File;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export function startUpload({
  formId,
  fieldId,
  file,
  onProgress,
  signal,
}: StartUploadOptions): Promise<UploadedFileRef> {
  return new Promise<UploadedFileRef>((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", `${apiOrigin()}/uploads/${formId}/${fieldId}`);
    request.withCredentials = true;

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(request.responseText) as Record<string, unknown>;
      } catch {
        /* A non-JSON body means something in front of the API answered — a proxy
         * error page, usually. Handled by the status check below. */
      }

      if (request.status !== 202) {
        reject(
          new UploadError(
            typeof parsed.error === "string" ? parsed.error : "Upload failed",
            request.status,
          ),
        );
        return;
      }

      resolve({
        uploadId: String(parsed.uploadId),
        claimToken: String(parsed.claimToken),
        name: typeof parsed.name === "string" ? parsed.name : file.name,
        mimeType: typeof parsed.mimeType === "string" ? parsed.mimeType : file.type,
        sizeBytes: typeof parsed.sizeBytes === "number" ? parsed.sizeBytes : file.size,
        status: "pending",
        url: null,
        error: null,
      });
    };

    request.onerror = () => reject(new UploadError("Network error while uploading", 0));
    request.onabort = () => reject(new UploadError("Upload cancelled", 0));

    signal?.addEventListener("abort", () => request.abort(), { once: true });

    request.send(body);
  });
}

/** Read one upload's current state. */
export async function fetchUploadStatus(
  uploadId: string,
  claimToken: string,
  signal?: AbortSignal,
): Promise<UploadedFileRef> {
  const response = await fetch(`${apiOrigin()}/uploads/${uploadId}`, {
    headers: { "X-Upload-Token": claimToken },
    credentials: "include",
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new UploadError("Could not read upload status", response.status);
  }

  const data = (await response.json()) as {
    uploadId: string;
    status: UploadedFileRef["status"];
    name: string;
    mimeType: string;
    sizeBytes: number;
    url: string | null;
    error: string | null;
  };

  return { ...data, claimToken };
}

export const UPLOAD_STILL_PROCESSING = "UPLOAD_STILL_PROCESSING";

export async function waitForUpload(
  ref: UploadedFileRef,
  options: { signal?: AbortSignal; onUpdate?: (next: UploadedFileRef) => void } = {},
): Promise<{ ref: UploadedFileRef; timedOut: boolean }> {
  const deadline = Date.now() + 120_000;
  let delay = 1_000;
  let latest = ref;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) return { ref: latest, timedOut: false };

    await new Promise((done) => setTimeout(done, delay));
    delay = Math.min(delay * 1.5, 5_000);

    try {
      latest = await fetchUploadStatus(ref.uploadId, ref.claimToken, options.signal);
      options.onUpdate?.(latest);
      if (latest.status === "ready" || latest.status === "failed") {
        return { ref: latest, timedOut: false };
      }
    } catch {
      /* A failed poll is not a failed upload — the file may well be stored
       * already. Keep trying until the deadline. */
    }
  }

  return { ref: latest, timedOut: true };
}

/** Human-readable size for the file chip. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isUploadAnswerComplete(value: unknown): boolean {
  const refs = Array.isArray(value) ? value : [value];
  if (refs.length === 0) return false;

  return refs.every((entry) => {
    const ref = entry as UploadedFileRef | null;
    if (!ref || typeof ref.uploadId !== "string") return false;
    // `pending` and `processing` are both "not finished". `failed` is terminal
    // and unusable.
    return ref.status === "ready";
  });
}

export function stripUploadSecrets(value: unknown): unknown {
  const scrub = (entry: unknown): unknown => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    if (!("claimToken" in entry)) return entry;

    const rest: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(entry as Record<string, unknown>)) {
      if (key !== "claimToken") rest[key] = item;
    }
    return rest;
  };

  return Array.isArray(value) ? value.map(scrub) : scrub(value);
}

export function downloadUrlFor(url: string, originalName: string): string {
  const marker = "/upload/";
  const at = url.indexOf(marker);
  if (at === -1) return url;

  const base = originalName.replace(/\.[^.]+$/, "");
  const slug = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (!slug) return url;

  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  return `${head}fl_attachment:${encodeURIComponent(slug)}/${tail}`;
}

/** Size ceilings the server enforces, in MB, per kind of file. */
export interface UploadLimits {
  maxMb: number;
  image: number;
  video: number;
  raw: number;
}

let limitsPromise: Promise<UploadLimits | null> | null = null;

export function fetchUploadLimits(): Promise<UploadLimits | null> {
  if (limitsPromise) return limitsPromise;

  limitsPromise = fetch(`${apiOrigin()}/uploads/limits`)
    .then((res) => (res.ok ? (res.json() as Promise<UploadLimits>) : null))
    .catch(() => null);

  return limitsPromise;
}

function kindsFor(accept: string[] | undefined): Array<keyof Omit<UploadLimits, "maxMb">> {
  if (!accept || accept.length === 0) return ["image", "video", "raw"];

  const kinds = new Set<keyof Omit<UploadLimits, "maxMb">>();

  for (const raw of accept) {
    const rule = raw.trim().toLowerCase();
    if (rule.startsWith("image/")) kinds.add("image");
    else if (rule.startsWith("video/") || rule.startsWith("audio/")) kinds.add("video");
    else if (rule.startsWith(".")) {
      kinds.add("image");
      kinds.add("video");
      kinds.add("raw");
    } else kinds.add("raw");
  }

  return [...kinds];
}

export function limitLabel(
  accept: string[] | undefined,
  authorMaxMb: number | undefined,
  limits: UploadLimits | null,
): string | null {
  if (!limits) return authorMaxMb ? `up to ${authorMaxMb}MB` : null;

  const ceiling = authorMaxMb ?? Number.POSITIVE_INFINITY;
  const kinds = kindsFor(accept);

  const effective = kinds.map((kind) => ({
    kind,
    mb: Math.min(ceiling, limits[kind], limits.maxMb),
  }));

  const distinct = [...new Set(effective.map((entry) => entry.mb))];

  if (distinct.length === 1) return `up to ${distinct[0]}MB`;

  const wording: Record<string, string> = {
    image: "images",
    video: "audio/video",
    raw: "documents",
  };
  return effective
    .sort((a, b) => a.mb - b.mb)
    .map((entry) => `${wording[entry.kind]} up to ${entry.mb}MB`)
    .join(" · ");
}
