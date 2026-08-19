"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { env } from "~/env";

export type PptxImportStatus =
  | "IDLE"
  | "UPLOADING"
  | "UPLOADED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface PptxImportProgress {
  importId: string | null;
  status: PptxImportStatus;
  processedSlides: number;
  totalSlides: number;
  errorInfo: string | null;
  uploadProgress: number; // 0 to 100
}

interface UsePowerPointImportProps {
  presentationId: string;
  onSuccess?: (importId: string, totalSlides: number) => void;
  onError?: (error: string) => void;
}

export function usePowerPointImport({
  presentationId,
  onSuccess,
  onError,
}: UsePowerPointImportProps) {
  const [progress, setProgress] = useState<PptxImportProgress>({
    importId: null,
    status: "IDLE",
    processedSlides: 0,
    totalSlides: 0,
    errorInfo: null,
    uploadProgress: 0,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeImportIdRef = useRef<string | null>(null);
  const isFinishedRef = useRef<boolean>(false);

  const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";

  // Stop polling and socket listeners
  const stopTracking = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Poll fallback query
  const pollStatus = useCallback(
    async (importId: string) => {
      if (isFinishedRef.current) return;
      try {
        const res = await fetch(`${baseUrl}/api/presentations/${presentationId}/imports/${importId}`, {
          credentials: "include",
        });
        if (!res.ok) return;

        const data = await res.json();
        const serverStatus = (data.status || "").toUpperCase() as PptxImportStatus;

        setProgress((prev) => ({
          ...prev,
          status: serverStatus,
          processedSlides: data.processedSlides || 0,
          totalSlides: data.totalSlides || 0,
          errorInfo: data.errorInfo || null,
        }));

        if (serverStatus === "COMPLETED") {
          isFinishedRef.current = true;
          stopTracking();
          if (onSuccess) {
            onSuccess(importId, data.totalSlides || 0);
          }
        } else if (serverStatus === "FAILED" || serverStatus === "CANCELLED") {
          isFinishedRef.current = true;
          stopTracking();
          if (serverStatus === "FAILED" && onError) {
            onError(data.errorInfo || "PowerPoint conversion failed.");
          }
        }
      } catch (err) {
        console.warn("[PPTX Import] Polling error:", err);
      }
    },
    [baseUrl, presentationId, onSuccess, onError, stopTracking]
  );

  // Setup Socket listener & fallback polling
  const startTracking = useCallback(
    (importId: string) => {
      activeImportIdRef.current = importId;
      isFinishedRef.current = false;
      stopTracking();

      // 1. Socket.IO connection for real-time progress events
      try {
        const socket = io(baseUrl, {
          withCredentials: true,
        });
        socketRef.current = socket;

        socket.on("import:progress", (event: any) => {
          if (event.importId !== importId) return;

          const serverStatus = (event.status || "").toUpperCase() as PptxImportStatus;
          setProgress((prev) => ({
            ...prev,
            status: serverStatus,
            processedSlides: event.processedSlides ?? prev.processedSlides,
            totalSlides: event.totalSlides ?? prev.totalSlides,
            errorInfo: event.errorInfo || null,
          }));

          if (serverStatus === "COMPLETED") {
            isFinishedRef.current = true;
            stopTracking();
            if (onSuccess) {
              onSuccess(importId, event.totalSlides || 0);
            }
          } else if (serverStatus === "FAILED" || serverStatus === "CANCELLED") {
            isFinishedRef.current = true;
            stopTracking();
            if (serverStatus === "FAILED" && onError) {
              onError(event.errorInfo || "PowerPoint conversion failed.");
            }
          }
        });
      } catch (err) {
        console.warn("[PPTX Import] Socket init error:", err);
      }

      // 2. Resilient fallback polling every 1.5s
      pollIntervalRef.current = setInterval(() => {
        pollStatus(importId);
      }, 1500);

      // Trigger immediate first poll
      pollStatus(importId);
    },
    [baseUrl, stopTracking, pollStatus, onSuccess, onError]
  );

  // Main Upload and Start Import Trigger
  const startImport = useCallback(
    (file: File, position?: number) => {
      return new Promise<{ importId: string }>((resolve, reject) => {
        if (!file) {
          const err = "No file selected";
          if (onError) onError(err);
          return reject(new Error(err));
        }

        if (!file.name.toLowerCase().endsWith(".pptx")) {
          const err = "Only PowerPoint (.pptx) presentation files are supported.";
          if (onError) onError(err);
          return reject(new Error(err));
        }

        if (file.size > 50 * 1024 * 1024) {
          const err = "File size exceeds 50MB limit.";
          if (onError) onError(err);
          return reject(new Error(err));
        }

        setProgress({
          importId: null,
          status: "UPLOADING",
          processedSlides: 0,
          totalSlides: 0,
          errorInfo: null,
          uploadProgress: 0,
        });

        const formData = new FormData();
        formData.append("file", file);
        if (typeof position === "number" && !isNaN(position)) {
          formData.append("position", position.toString());
        }

        const xhr = new XMLHttpRequest();
        const uploadUrl = `${baseUrl}/api/presentations/${presentationId}/import-pptx${
          typeof position === "number" ? `?position=${position}` : ""
        }`;

        xhr.open("POST", uploadUrl, true);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setProgress((prev) => ({
              ...prev,
              uploadProgress: percent,
            }));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              const importId = res.importId;
              setProgress((prev) => ({
                ...prev,
                importId,
                status: "PROCESSING",
                uploadProgress: 100,
                totalSlides: res.totalSlides || 0,
                processedSlides: res.processedSlides || 0,
              }));

              startTracking(importId);
              resolve({ importId });
            } catch {
              const err = "Invalid response from server";
              setProgress((prev) => ({ ...prev, status: "FAILED", errorInfo: err }));
              if (onError) onError(err);
              reject(new Error(err));
            }
          } else {
            let errorMsg = `Upload failed with status ${xhr.status}`;
            try {
              const parsed = JSON.parse(xhr.responseText);
              if (parsed.error) errorMsg = parsed.error;
            } catch {
              // ignore
            }
            setProgress((prev) => ({ ...prev, status: "FAILED", errorInfo: errorMsg }));
            if (onError) onError(errorMsg);
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          const errorMsg = "Network error during PowerPoint upload.";
          setProgress((prev) => ({ ...prev, status: "FAILED", errorInfo: errorMsg }));
          if (onError) onError(errorMsg);
          reject(new Error(errorMsg));
        };

        xhr.send(formData);
      });
    },
    [baseUrl, presentationId, startTracking, onError]
  );

  // Cancel In-Progress Import
  const cancelImport = useCallback(async () => {
    const importId = activeImportIdRef.current || progress.importId;
    if (!importId) return;

    try {
      await fetch(`${baseUrl}/api/presentations/${presentationId}/imports/${importId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      isFinishedRef.current = true;
      stopTracking();
      setProgress((prev) => ({
        ...prev,
        status: "CANCELLED",
      }));
    } catch (err) {
      console.warn("[PPTX Import] Cancel error:", err);
    }
  }, [baseUrl, presentationId, progress.importId, stopTracking]);

  const reset = useCallback(() => {
    stopTracking();
    activeImportIdRef.current = null;
    isFinishedRef.current = false;
    setProgress({
      importId: null,
      status: "IDLE",
      processedSlides: 0,
      totalSlides: 0,
      errorInfo: null,
      uploadProgress: 0,
    });
  }, [stopTracking]);

  return {
    progress,
    isUploading: progress.status === "UPLOADING",
    isProcessing: progress.status === "PROCESSING" || progress.status === "UPLOADED",
    isFinished: progress.status === "COMPLETED",
    isFailed: progress.status === "FAILED",
    isCancelled: progress.status === "CANCELLED",
    startImport,
    cancelImport,
    reset,
  };
}
