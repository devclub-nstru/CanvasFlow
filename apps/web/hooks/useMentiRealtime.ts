"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { env } from "~/env";
import type { MentiSlide, MentiLeaderboardSnapshot } from "~/lib/menti";

export interface QuizSessionState {
  slideId: string | null;
  startedAt: string | null;
  endsAt: string | null;
  durationMs: number | null;
  isLocked: boolean;
}

export interface RealtimeSessionState {
  session: {
    id: string;
    code?: string;
    status: "waiting" | "live" | "paused" | "finished" | "cancelled";
    version: number;
    settings?: any;
    currentSlideId: string | null;
    isVotingLocked: boolean;
    quizState?: QuizSessionState | null;
  };
  participantCount: number;
  currentSlide: MentiSlide | null;
  submittedSlideIds?: string[];
  leaderboard?: MentiLeaderboardSnapshot | null;
}

export interface QuizResponseResult {
  success: boolean;
  isCorrect?: boolean;
  pointsAwarded?: number;
  totalScore?: number;
  selectedOptionId?: string;
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
  const [leaderboard, setLeaderboard] = useState<MentiLeaderboardSnapshot | null>(null);
  const [lastResponseResult, setLastResponseResult] = useState<QuizResponseResult | null>(null);
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

  const socketRef = useRef<Socket | null>(null);

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
      const mappedSlide = state.currentSlide
        ? {
            ...state.currentSlide,
            id: state.currentSlide.id || state.currentSlide._id,
          }
        : null;

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

      if (state.leaderboard) {
        setLeaderboard(state.leaderboard);
      }

      setSessionState({
        session: {
          ...state.session,
          id: state.session.id || state.session._id,
          quizState: state.session.quizState || null,
        },
        participantCount: state.participantCount,
        currentSlide: mappedSlide,
        submittedSlideIds: state.submittedSlideIds || [],
        leaderboard: state.leaderboard || null,
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

    // Live Leaderboard Update Event from backend syncer
    socketInstance.on("leaderboard_update", (leaderboardData: MentiLeaderboardSnapshot) => {
      if (leaderboardData) {
        setLeaderboard(leaderboardData);
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

      return new Promise<QuizResponseResult>((resolve, reject) => {
        socketRef.current!.emit(
          "submit_response",
          {
            slideId: activeSlideIdStr,
            answer,
          },
          (response: any) => {
            if (response?.error) {
              reject(new Error(response.error));
            } else {
              // The ack wrapper returns { success: true, data: result }
              // The quiz result fields are inside response.data
              const resultData = response?.data ?? response;
              const result: QuizResponseResult = {
                success: true,
                isCorrect: resultData?.isCorrect,
                pointsAwarded: resultData?.pointsAwarded,
                totalScore: resultData?.totalScore,
                selectedOptionId: resultData?.selectedOptionId,
              };
              setLastResponseResult(result);
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

  return {
    socket,
    connectionStatus,
    sessionState,
    slideAnalytics,
    slideAnalyticsMap,
    leaderboard,
    lastResponseResult,
    submittedSlideIds,
    error,
    changeSlide,
    toggleVotingLock,
    changeSessionStatus,
    submitResponse,
  };
}
