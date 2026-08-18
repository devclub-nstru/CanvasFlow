"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { env } from "~/env";
import type { MentiSlide, QuizPhase } from "~/lib/menti";

export interface RealtimeSessionState {
  session: {
    id: string;
    code?: string;
    status: "waiting" | "live" | "paused" | "finished" | "cancelled";
    version: number;
    settings?: any;
    currentSlideId: string | null;
    isVotingLocked: boolean;
    /** Start of the current timed question's countdown, if any. */
    questionStartedAt?: string | null;
    /** Server-derived phase; clients re-derive it locally to animate. */
    quizPhase?: QuizPhase | null;
  };
  participantCount: number;
  currentSlide: MentiSlide | null;
  submittedSlideIds?: string[];
}

/** Result of a quiz submission, returned by the server's ack. */
export interface SubmitResult {
  success: boolean;
  isCorrect?: boolean;
  pointsAwarded?: number;
  responseTimeMs?: number;
}

/**
 * The participant's verdict on the most recent quiz question.
 *
 * Held here rather than inside the question component because that component
 * unmounts when the host advances, and the leaderboard slide that follows needs
 * to keep showing the participant whether they were right.
 */
export interface LastQuizResult {
  slideId: string;
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeMs: number;
}

export interface UseMentiRealtimeProps {
  sessionId: string;
  token?: string; // Participant token (optional for host)
  isHost?: boolean;
  disabled?: boolean;
}

export function useMentiRealtime({
  sessionId,
  token,
  isHost = false,
  disabled = false,
}: UseMentiRealtimeProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");
  const [sessionState, setSessionState] = useState<RealtimeSessionState | null>(null);
  const [slideAnalytics, setSlideAnalytics] = useState<any | null>(null);
  const [slideAnalyticsMap, setSlideAnalyticsMap] = useState<Record<string, any>>({});
  const [submittedSlideIds, setSubmittedSlideIds] = useState<string[]>(() => {
    if (typeof window !== "undefined" && sessionId) {
      try {
        const stored = sessionStorage.getItem(`cf_submitted_slides_${sessionId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed.map(String);
        }
      } catch {
        // ignore
      }
    }
    return [];
  });
  const [error, setError] = useState<string | null>(null);
  /**
   * serverClock - deviceClock, in ms. Quiz countdowns are derived from a server
   * timestamp, so a device with a skewed clock would otherwise show the wrong
   * remaining time. Slightly conservative: it ignores network latency, which
   * makes the client believe it has marginally MORE time than it does — the
   * server's grace window absorbs that.
   */
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [lastQuizResult, setLastQuizResult] = useState<LastQuizResult | null>(() => {
    if (typeof window === "undefined" || !sessionId) return null;
    try {
      const stored = sessionStorage.getItem(`cf_last_quiz_result_${sessionId}`);
      return stored ? (JSON.parse(stored) as LastQuizResult) : null;
    } catch {
      return null;
    }
  });

  const socketRef = useRef<Socket | null>(null);
  const currentSlideIdRef = useRef<string | null>(null);

  // Sync with sessionStorage whenever sessionId changes
  useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      try {
        const stored = sessionStorage.getItem(`cf_submitted_slides_${sessionId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setSubmittedSlideIds((prev) => Array.from(new Set([...prev, ...parsed.map(String)])));
          }
        }
      } catch {
        // ignore
      }
    }
  }, [sessionId]);

  useEffect(() => {
    if (disabled || !sessionId) return;

    const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";

    const options: any = {
      withCredentials: true,
      query: {},
    };

    if (token) {
      options.query.token = token;
    }
    if (isHost) {
      options.query.sessionId = sessionId;
    }

    const socketInstance = io(baseUrl, options);
    socketRef.current = socketInstance;
    setSocket(socketInstance);
    setConnectionStatus("connecting");

    socketInstance.on("connect", () => {
      setConnectionStatus("connected");
      setError(null);
      console.log(`[Realtime] Connected to presentation session (isHost=${isHost}):`, sessionId);
    });

    socketInstance.on("connect_error", (err: any) => {
      setConnectionStatus("error");
      setError(err?.message || "Connection error");
      console.error("[Realtime] Socket connection error:", err?.message);
    });

    socketInstance.on("disconnect", () => {
      setConnectionStatus("disconnected");
      console.log("[Realtime] Socket disconnected");
    });

    socketInstance.on("error", (data: { message: string }) => {
      setError(data.message);
    });

    // Session State Sync Event from backend syncer
    socketInstance.on("session_state_sync", (state: any) => {
      if (typeof state.serverNow === "number") {
        setServerOffsetMs(state.serverNow - Date.now());
      }

      const mappedSlide = state.currentSlide
        ? {
            ...state.currentSlide,
            id: state.currentSlide.id || state.currentSlide._id,
          }
        : null;

      // Clear stale analytics immediately when the slide changes so the previous
      // slide's data is never shown under the new slide's renderer.
      const incomingSlideId = state.session?.currentSlideId ?? null;
      if (incomingSlideId !== currentSlideIdRef.current) {
        currentSlideIdRef.current = incomingSlideId;
        setSlideAnalytics(null);
      }

      // If presenter reset session to waiting, clear submitted slides
      if (state.session?.status === "waiting") {
        setSubmittedSlideIds([]);
        if (typeof window !== "undefined" && sessionId) {
          sessionStorage.removeItem(`cf_submitted_slides_${sessionId}`);
        }
      } else if (Array.isArray(state.submittedSlideIds) && state.submittedSlideIds.length > 0) {
        setSubmittedSlideIds((prev) => {
          const merged = Array.from(new Set([...prev, ...state.submittedSlideIds.map(String)]));
          if (typeof window !== "undefined" && sessionId) {
            sessionStorage.setItem(`cf_submitted_slides_${sessionId}`, JSON.stringify(merged));
          }
          return merged;
        });
      }

      setSessionState({
        session: {
          ...state.session,
          id: state.session.id || state.session._id,
        },
        participantCount: state.participantCount,
        currentSlide: mappedSlide,
        submittedSlideIds: state.submittedSlideIds || [],
      });
      setConnectionStatus("connected");
    });

    // Live Aggregate Analytics Update Event from backend syncer
    socketInstance.on("slide_analytics_update", (analytics: any) => {
      if (analytics?.slideId) {
        setSlideAnalyticsMap((prev) => ({
          ...prev,
          [analytics.slideId]: analytics,
        }));
        setSlideAnalytics(analytics);
      }
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [sessionId, token, isHost, disabled]);

  // Host Action: Navigate Slide
  const changeSlide = useCallback(
    (slideId: string) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit("change_slide", { slideId }, (response: any) => {
        if (response?.error) {
          console.error("[Realtime] Failed to change slide:", response.error);
        }
      });
    },
    [isHost],
  );

  // Host Action: Toggle Lock
  const toggleVotingLock = useCallback(
    (isLocked: boolean) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit("toggle_voting_lock", { isLocked }, (response: any) => {
        if (response?.error) {
          console.error("[Realtime] Failed to toggle lock:", response.error);
        }
      });
    },
    [isHost],
  );

  // Host Action: Change Status (waiting, live, paused, finished, cancelled)
  const changeSessionStatus = useCallback(
    async (status: "waiting" | "live" | "paused" | "finished" | "cancelled") => {
      if (!socketRef.current || !isHost) return;
      return new Promise<{ success: boolean }>((resolve, reject) => {
        socketRef.current!.emit("change_session_status", { status }, (response: any) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve({ success: true });
          }
        });
      });
    },
    [isHost],
  );

  // Participant Action: Submit Response
  const submitResponse = useCallback(
    (answer: any, targetSlideId?: string) => {
      const activeSlideId = targetSlideId || sessionState?.currentSlide?.id;
      if (!socketRef.current || isHost || !activeSlideId) {
        return Promise.reject(new Error("Cannot submit answer: Socket not ready or missing slide ID"));
      }

      const activeSlideIdStr = String(activeSlideId);

      const isUnlimitedWordCloud = Boolean(
        sessionState?.currentSlide?.type === "WORD_CLOUD" &&
        (sessionState.currentSlide.responseSettings?.multipleSubmissions === true ||
          sessionState.currentSlide.responseSettings?.maxEntriesPerParticipant === 0)
      );

      // Optimistically record submitted slide ID if not unlimited
      if (!isUnlimitedWordCloud) {
        setSubmittedSlideIds((prev) => {
          const next = Array.from(new Set([...prev, activeSlideIdStr]));
          if (typeof window !== "undefined" && sessionId) {
            sessionStorage.setItem(`cf_submitted_slides_${sessionId}`, JSON.stringify(next));
          }
          return next;
        });
      }

      /**
       * Undo the optimistic mark above when the server refuses the answer,
       * otherwise a rejected attempt (e.g. submitted a hair too early) would
       * leave the participant permanently locked out of the question. An
       * "already submitted" refusal is left marked — that one is accurate.
       */
      const rollbackOptimisticMark = (message: string) => {
        if (isUnlimitedWordCloud) return;
        if (message.toLowerCase().includes("already submitted")) return;

        setSubmittedSlideIds((prev) => {
          const next = prev.filter((id) => id !== activeSlideIdStr);
          if (typeof window !== "undefined" && sessionId) {
            sessionStorage.setItem(`cf_submitted_slides_${sessionId}`, JSON.stringify(next));
          }
          return next;
        });
      };

      return new Promise<SubmitResult>((resolve, reject) => {
        socketRef.current!.emit(
          "submit_response",
          {
            slideId: activeSlideIdStr,
            answer,
          },
          (response: any) => {
            if (response?.error) {
              rollbackOptimisticMark(String(response.error));
              reject(new Error(response.error));
            } else {
              // Pass the ack through verbatim — quiz slides return isCorrect and
              // pointsAwarded here, which is the participant's only way to learn
              // their result before the host reveals it.
              const result: SubmitResult = { success: true, ...(response ?? {}) };

              // Remember a quiz verdict so the leaderboard slide can still show
              // it after the question component unmounts.
              if (typeof result.isCorrect === "boolean") {
                const verdict: LastQuizResult = {
                  slideId: activeSlideIdStr,
                  isCorrect: result.isCorrect,
                  pointsAwarded: Number(result.pointsAwarded ?? 0),
                  responseTimeMs: Number(result.responseTimeMs ?? 0),
                };
                setLastQuizResult(verdict);
                if (typeof window !== "undefined" && sessionId) {
                  sessionStorage.setItem(
                    `cf_last_quiz_result_${sessionId}`,
                    JSON.stringify(verdict),
                  );
                }
              }

              resolve(result);
            }
          },
        );
      });
    },
    [
      isHost,
      sessionState?.currentSlide?.id,
      sessionState?.currentSlide?.type,
      sessionState?.currentSlide?.responseSettings?.multipleSubmissions,
      sessionState?.currentSlide?.responseSettings?.maxEntriesPerParticipant,
      sessionId,
    ],
  );

  // Host Action: (re)start the timer on the current quiz question
  const startQuestion = useCallback(() => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit("start_question", {}, (response: any) => {
      if (response?.error) {
        console.error("[Realtime] Failed to start question:", response.error);
      }
    });
  }, [isHost]);

  return {
    socket,
    connectionStatus,
    sessionState,
    slideAnalytics,
    slideAnalyticsMap,
    submittedSlideIds,
    serverOffsetMs,
    lastQuizResult,
    error,
    changeSlide,
    toggleVotingLock,
    changeSessionStatus,
    startQuestion,
    submitResponse,
  };
}
