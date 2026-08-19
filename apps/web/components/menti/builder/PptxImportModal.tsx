"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  ArrowRight,
  Layers,
} from "lucide-react";
import { usePowerPointImport } from "~/hooks/api/menti/usePowerPointImport";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  presentationId: string;
  slidesCount: number;
  activeSlideIndex: number;
  onImportCompleted: (targetPosition: number, totalSlides: number) => void;
}

export function PptxImportModal({
  isOpen,
  onClose,
  presentationId,
  slidesCount,
  activeSlideIndex,
  onImportCompleted,
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [insertOption, setInsertOption] = useState<"end" | "after_active">("end");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetPosition =
    insertOption === "after_active" && activeSlideIndex >= 0
      ? activeSlideIndex + 1
      : slidesCount;

  const {
    progress,
    isUploading,
    isProcessing,
    isFinished,
    isFailed,
    isCancelled,
    startImport,
    cancelImport,
    reset,
  } = usePowerPointImport({
    presentationId,
    onSuccess: (importId, total) => {
      toast.success(`Imported ${total} slides from PowerPoint`);
      onImportCompleted(targetPosition, total);
    },
    onError: (err) => {
      toast.error(err || "Failed to import PowerPoint file");
    },
  });

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading && !isProcessing) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUploading, isProcessing]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isUploading || isProcessing) {
      if (confirm("An import is currently in progress. Do you want to cancel it?")) {
        cancelImport();
        reset();
        setSelectedFile(null);
        onClose();
      }
      return;
    }
    reset();
    setSelectedFile(null);
    onClose();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      toast.error("Please select a valid PowerPoint (.pptx) file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50MB maximum size");
      return;
    }
    setSelectedFile(file);
  };

  const handleStart = async () => {
    if (!selectedFile) return;
    try {
      await startImport(selectedFile, targetPosition);
    } catch {
      // Error handled in hook
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isWorking = isUploading || isProcessing;
  const progressPercent =
    progress.totalSlides > 0
      ? Math.round((progress.processedSlides / progress.totalSlides) * 100)
      : isUploading
      ? progress.uploadProgress
      : 0;

  return (
    <div className="cf-scrim z-300">
      <div className="cf-dialog max-w-lg w-full max-h-[90vh]">
        {/* Top Header */}
        <div className="cf-dialog-bar">
          <span className="truncate">Import · PowerPoint (.pptx)</span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isWorking}
              className="cf-btn-outline size-7 disabled:opacity-40"
              aria-label="Close dialog"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="cf-dialog-body space-y-5">
          {/* State 1: IDLE / FILE SELECTION */}
          {!isWorking && !isFinished && !isFailed && !isCancelled && (
            <>
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-6 border border-dashed transition-all cursor-pointer select-none text-center ${
                  isDragging
                    ? "border-(--cf-orange) bg-amber-50"
                    : selectedFile
                    ? "border-(--cf-line-strong) bg-white"
                    : "border-(--cf-line-strong) bg-(--cf-cream) hover:bg-(--cf-cream-2)"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 border border-(--cf-line-strong) bg-(--cf-cream) text-(--cf-orange)">
                      <FileCode className="size-7" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-medium text-(--cf-ink) max-w-xs truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] font-mono text-(--cf-ink-soft)">
                        {formatFileSize(selectedFile.size)} · Click or drop to replace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 border border-(--cf-line-strong) bg-white text-(--cf-ink)">
                      <Upload className="size-5 text-(--cf-orange)" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-(--cf-ink)">
                        Click to upload or drag & drop
                      </p>
                      <p className="text-[11px] text-(--cf-ink-soft) mt-0.5 font-mono">
                        PowerPoint presentation (.pptx) up to 50MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Insertion Position Strategy */}
              <div>
                <p className="cf-meta mb-2">Insert position</p>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setInsertOption("end")}
                    className="flex w-full items-start gap-2.5 border px-3 py-2.5 text-left transition-colors cursor-pointer"
                    style={{
                      borderColor:
                        insertOption === "end" ? "var(--cf-orange)" : "var(--cf-line-strong)",
                      background:
                        insertOption === "end" ? "var(--cf-cream)" : "var(--cf-cream-2)",
                      boxShadow:
                        insertOption === "end" ? "3px 3px 0 0 var(--cf-orange)" : undefined,
                    }}
                  >
                    <Layers className="mt-0.5 size-3.5 shrink-0 text-(--cf-orange)" />
                    <div className="min-w-0">
                      <span className="block text-[13px] font-medium text-(--cf-ink)">
                        At the end of presentation
                      </span>
                      <span className="block text-[11.5px] text-(--cf-ink-soft)">
                        Appends after slide {slidesCount}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInsertOption("after_active")}
                    className="flex w-full items-start gap-2.5 border px-3 py-2.5 text-left transition-colors cursor-pointer"
                    style={{
                      borderColor:
                        insertOption === "after_active"
                          ? "var(--cf-orange)"
                          : "var(--cf-line-strong)",
                      background:
                        insertOption === "after_active"
                          ? "var(--cf-cream)"
                          : "var(--cf-cream-2)",
                      boxShadow:
                        insertOption === "after_active"
                          ? "3px 3px 0 0 var(--cf-orange)"
                          : undefined,
                    }}
                  >
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-(--cf-orange)" />
                    <div className="min-w-0">
                      <span className="block text-[13px] font-medium text-(--cf-ink)">
                        After current slide
                      </span>
                      <span className="block text-[11.5px] text-(--cf-ink-soft)">
                        Inserts after slide {activeSlideIndex + 1}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Note */}
              <p className="text-[11.5px] leading-relaxed text-(--cf-ink-soft)">
                Each PowerPoint slide is converted into a high-fidelity visual slide. You can freely
                reorder and interleave them with quiz competitions and polls.
              </p>
            </>
          )}

          {/* State 2: WORKING (UPLOADING / PROCESSING) */}
          {isWorking && (
            <div className="py-6 flex flex-col items-center text-center space-y-4">
              <div className="size-10 border border-(--cf-line-strong) bg-(--cf-cream) flex items-center justify-center">
                <Loader2 className="size-5 text-(--cf-orange) animate-spin" />
              </div>

              <div className="space-y-1 max-w-sm">
                <h4 className="text-[15px] font-medium text-(--cf-ink)">
                  {isUploading ? "Uploading PowerPoint file..." : "Processing slides..."}
                </h4>
                <p className="text-[12px] text-(--cf-ink-soft)">
                  {isUploading
                    ? `Uploading ${selectedFile?.name || "file"} (${progress.uploadProgress}%)`
                    : progress.totalSlides > 0
                    ? `Rendering slide ${progress.processedSlides} of ${progress.totalSlides}...`
                    : "Converting presentation with server engine..."}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-(--cf-ink-soft)">
                  <span>{isUploading ? "UPLOADING" : "CONVERTING"}</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-(--cf-cream-2) border border-(--cf-line-strong) overflow-hidden">
                  <div
                    className="h-full bg-(--cf-orange) transition-all duration-300"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={cancelImport}
                  className="cf-btn-outline h-8 px-3 text-[12px]"
                >
                  Cancel import
                </button>
              </div>
            </div>
          )}

          {/* State 3: COMPLETED */}
          {isFinished && (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="size-10 border border-(--cf-line-strong) bg-(--cf-cream) flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="size-5" />
              </div>

              <div className="space-y-1">
                <h4 className="text-[15px] font-medium text-(--cf-ink)">Import completed</h4>
                <p className="text-[12.5px] text-(--cf-ink-soft)">
                  Successfully imported {progress.totalSlides} slides into your presentation.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="cf-btn h-8 px-4 text-[12px]"
                >
                  View slides
                </button>
              </div>
            </div>
          )}

          {/* State 4: FAILED */}
          {isFailed && (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="size-10 border border-(--cf-line-strong) bg-(--cf-cream) flex items-center justify-center text-red-600">
                <AlertCircle className="size-5" />
              </div>

              <div className="space-y-1 max-w-sm">
                <h4 className="text-[15px] font-medium text-(--cf-ink)">Import failed</h4>
                <p className="text-[12px] text-red-600">
                  {progress.errorInfo || "An unexpected error occurred during conversion."}
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="cf-btn-outline h-8 px-3 text-[12px]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="cf-btn h-8 px-4 text-[12px]"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* State 5: CANCELLED */}
          {isCancelled && (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="size-10 border border-(--cf-line-strong) bg-(--cf-cream) flex items-center justify-center text-(--cf-ink-soft)">
                <X className="size-5" />
              </div>

              <div className="space-y-1">
                <h4 className="text-[15px] font-medium text-(--cf-ink)">Import cancelled</h4>
                <p className="text-[12px] text-(--cf-ink-soft)">
                  The PowerPoint import was cancelled and rolled back.
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="cf-btn-outline h-8 px-3 text-[12px]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="cf-btn h-8 px-4 text-[12px]"
                >
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (for idle selection phase) */}
        {!isWorking && !isFinished && !isFailed && !isCancelled && (
          <div className="cf-dialog-foot">
            <span className="min-w-0 truncate text-[11.5px] text-(--cf-ink-soft)">
              {selectedFile ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})` : "No file chosen"}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="cf-btn-outline h-8 px-3 text-[12px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={!selectedFile}
                className="cf-btn h-8 px-4 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
