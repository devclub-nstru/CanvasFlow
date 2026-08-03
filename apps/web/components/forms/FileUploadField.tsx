"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";

import {
  fetchUploadLimits,
  formatBytes,
  limitLabel,
  startUpload,
  waitForUpload,
  UploadError,
  type UploadedFileRef,
  type UploadLimits,
} from "~/lib/upload";

interface FileUploadFieldProps {
  formId: string;
  fieldId: string;
  inputId: string;
  placeholder?: string | null;
  options?: { accept?: string[]; maxMb?: number; maxFiles?: number } | null;
  value: UploadedFileRef | UploadedFileRef[] | null | undefined;
  onChange: (value: UploadedFileRef[] | UploadedFileRef | null) => void;
  disabled?: boolean;
}

export function FileUploadField({
  formId,
  fieldId,
  inputId,
  placeholder,
  options,
  value,
  onChange,
  disabled = false,
}: FileUploadFieldProps) {
  const maxFiles = Math.max(1, options?.maxFiles ?? 1);
  const multiple = maxFiles > 1;

  const files = React.useMemo<UploadedFileRef[]>(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );

  const [inFlight, setInFlight] = useState<Array<{ key: number; name: string; percent: number }>>(
    [],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [limits, setLimits] = useState<UploadLimits | null>(null);
  useEffect(() => {
    let active = true;
    void fetchUploadLimits().then((next) => {
      if (active) setLimits(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    return () => controller.abort();
  }, []);

  const listRef = useRef<UploadedFileRef[]>(files);
  useEffect(() => {
    listRef.current = files;
  }, [files]);

  const mutate = useCallback(
    (fn: (current: UploadedFileRef[]) => UploadedFileRef[]) => {
      const next = fn(listRef.current).slice(0, maxFiles);
      listRef.current = next;
      onChange(multiple ? next : (next[0] ?? null));
    },
    [maxFiles, multiple, onChange],
  );

  const upsert = useCallback(
    (ref: UploadedFileRef) => {
      if (dismissedRef.current.has(ref.uploadId)) return;

      mutate((current) =>
        current.some((entry) => entry.uploadId === ref.uploadId)
          ? current.map((entry) => (entry.uploadId === ref.uploadId ? ref : entry))
          : [...current, ref],
      );
    },
    [mutate],
  );

  const queueRef = useRef<File[]>([]);
  const pumpingRef = useRef(false);
  const keyRef = useRef(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const inFlightCountRef = useRef(0);

  const dismissedRef = useRef<Set<string>>(new Set());

  const track = useCallback(
    async (started: UploadedFileRef) => {
      const outcome = await waitForUpload(started, {
        ...(abortRef.current?.signal ? { signal: abortRef.current.signal } : {}),
        onUpdate: (next) => upsert(next),
      });

      if (dismissedRef.current.has(started.uploadId)) return;

      if (outcome.ref.status === "failed") {
        setMessage(`“${outcome.ref.name}” — ${outcome.ref.error ?? "could not be processed."}`);
      } else if (outcome.timedOut) {
        setMessage(
          `“${outcome.ref.name}” is taking longer than expected. It may still finish — ` +
            `remove and re-add it if it doesn't.`,
        );
      }
    },
    [upsert],
  );

  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;

    try {
      for (;;) {
        const file = queueRef.current.shift();
        if (!file) break;
        setQueuedCount(queueRef.current.length);

        const key = ++keyRef.current;
        setInFlight((current) => [...current, { key, name: file.name, percent: 0 }]);

        try {
          const started = await startUpload({
            formId,
            fieldId,
            file,
            onProgress: (percent) =>
              setInFlight((current) =>
                current.map((entry) => (entry.key === key ? { ...entry, percent } : entry)),
              ),
            ...(abortRef.current?.signal ? { signal: abortRef.current.signal } : {}),
          });

          upsert(started);

          void track(started);
        } catch (err) {
          setMessage(
            err instanceof UploadError
              ? `“${file.name}” — ${err.message}`
              : `Something went wrong uploading “${file.name}”.`,
          );
        } finally {
          setInFlight((current) => current.filter((entry) => entry.key !== key));
        }
      }
    } finally {
      pumpingRef.current = false;
    }
  }, [fieldId, formId, track, upsert]);

  const handleFiles = useCallback(
    (picked: FileList | null) => {
      if (!picked || picked.length === 0 || disabled) return;

      setMessage(null);
      const reserved = listRef.current.length + queueRef.current.length + inFlightCountRef.current;
      const room = maxFiles - reserved;

      if (room <= 0) {
        setMessage(
          maxFiles === 1
            ? "Remove the current file to attach a different one."
            : `You can attach at most ${maxFiles} files.`,
        );
        return;
      }

      const chosen = Array.from(picked).slice(0, room);
      if (chosen.length < picked.length) {
        setMessage(`Only the first ${room} file${room === 1 ? "" : "s"} were added.`);
      }

      queueRef.current.push(...chosen);
      setQueuedCount(queueRef.current.length);

      if (inputRef.current) inputRef.current.value = "";

      void pump();
    },
    [disabled, maxFiles, pump],
  );

  useEffect(() => {
    inFlightCountRef.current = inFlight.length;
  }, [inFlight]);

  const remove = (uploadId: string) => {
    setMessage(null);
    dismissedRef.current.add(uploadId);
    mutate((current) => current.filter((entry) => entry.uploadId !== uploadId));
  };

  const atCapacity = files.length + queuedCount + inFlight.length >= maxFiles;

  return (
    <div className="space-y-3">
      {/* ── drop zone ── */}
      {!atCapacity && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className="border border-dashed transition-colors"
          style={{
            borderColor: dragging ? "var(--cf-orange)" : "var(--cf-line-strong)",
            background: dragging ? "rgba(232, 122, 65, 0.06)" : "#fff",
          }}
        >
          <label
            htmlFor={inputId}
            className={`flex flex-col items-center justify-center gap-2 px-4 py-7 text-center ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
          >
            <UploadCloud className="size-6 text-(--cf-orange)" aria-hidden />
            <span className="text-[14px] font-medium text-(--cf-ink)">
              {placeholder ||
                (multiple ? "Choose files or drag them here" : "Choose a file or drag it here")}
            </span>
            <span className="font-mono text-[10.5px] tracking-wide text-(--cf-ink-soft)/70">
              {[
                options?.accept?.length ? options.accept.join(", ") : null,
                limitLabel(options?.accept, options?.maxMb, limits),
                multiple ? `up to ${maxFiles} files` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Attach a document"}
            </span>
          </label>

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            multiple={multiple}
            disabled={disabled}
            {...(options?.accept?.length ? { accept: options.accept.join(",") } : {})}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* ── transferring ── */}
      {inFlight.map((entry) => (
        <div
          key={entry.key}
          className="border px-3 py-2.5"
          style={{ borderColor: "var(--cf-line-strong)" }}
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 shrink-0 animate-spin text-(--cf-orange)" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px] text-(--cf-ink)">
              {entry.name}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-(--cf-ink-soft)">
              {entry.percent}%
            </span>
          </div>
          <div
            className="mt-2 h-1 w-full overflow-hidden"
            style={{ background: "rgba(26,29,41,0.10)" }}
            role="progressbar"
            aria-valuenow={entry.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Uploading ${entry.name}`}
          >
            <div
              className="h-full transition-[width] duration-200"
              style={{ width: `${entry.percent}%`, background: "var(--cf-orange)" }}
            />
          </div>
        </div>
      ))}

      {queuedCount > 0 && (
        <p className="font-mono text-[10.5px] tracking-wide text-(--cf-ink-soft)">
          {queuedCount} more waiting to upload
        </p>
      )}

      {/* ── attached ── */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.uploadId}
              className="flex items-center gap-2.5 border px-3 py-2.5"
              style={{ borderColor: "var(--cf-line-strong)", background: "var(--cf-cream)" }}
            >
              <StatusIcon status={file.status} />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-(--cf-ink)">{file.name}</span>
                <span className="block font-mono text-[10.5px] tracking-wide text-(--cf-ink-soft)/75">
                  {formatBytes(file.sizeBytes)} · {statusLabel(file.status)}
                </span>
              </span>

              <button
                type="button"
                onClick={() => remove(file.uploadId)}
                disabled={disabled}
                className="shrink-0 cursor-pointer p-1 text-(--cf-ink-soft) transition-colors hover:text-(--cf-ink) disabled:cursor-not-allowed"
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p className="flex items-start gap-1.5 text-[12.5px] text-(--cf-orange)" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadedFileRef["status"] }) {
  if (status === "ready") {
    return <CheckCircle2 className="size-4 shrink-0 text-(--cf-orange)" aria-hidden />;
  }
  if (status === "failed") {
    return <AlertCircle className="size-4 shrink-0 text-(--cf-orange)" aria-hidden />;
  }
  return <Loader2 className="size-4 shrink-0 animate-spin text-(--cf-ink-soft)" aria-hidden />;
}

function statusLabel(status: UploadedFileRef["status"]): string {
  switch (status) {
    case "ready":
      return "Attached";
    case "failed":
      return "Could not be attached";
    case "processing":
      return "Processing...";
    default:
      return "Uploading...";
  }
}
