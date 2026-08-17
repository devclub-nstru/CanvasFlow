"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { env } from "~/env";
import type { MentiSlide } from "~/lib/menti";

export interface RealtimeSessionState {
  session: {
    id: string;
    code?: string;
    status: "waiting" | "live" | "paused" | "finished" | "cancelled";
    version: number;
    settings?: any;
    currentSlideId: string | null;
    isVotingLocked: boolean;
  };
  participantCount: number;
  currentSlide: MentiSlide | null;
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
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

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

    // Session State Sync Event
    socketInstance.on("session_state", (state: RealtimeSessionState) => {
      setSessionState(state);
      setConnectionStatus("connected");
    });

    // Participant Joined Event
    socketInstance.on("participant_joined", (data: { count: number }) => {
      setSessionState((prev) => (prev ? { ...prev, participantCount: data.count } : null));
    });

    // Participant Left Event
    socketInstance.on("participant_left", (data: { count: number }) => {
      setSessionState((prev) => (prev ? { ...prev, participantCount: data.count } : null));
    });

    // Slide Changed by Host Event
    socketInstance.on("slide_changed", (data: { slide: MentiSlide; index: number }) => {
      setSessionState((prev) =>
        prev
          ? {
              ...prev,
              currentSlide: data.slide,
              session: {
                ...prev.session,
                currentSlideId: data.slide.id,
              },
            }
          : null,
      );
    });

    // Voting Lock Changed Event
    socketInstance.on("voting_lock_changed", (data: { isLocked: boolean }) => {
      setSessionState((prev) =>
        prev
          ? {
              ...prev,
              session: {
                ...prev.session,
                isVotingLocked: data.isLocked,
              },
            }
          : null,
      );
    });

    // Session Status Changed Event
    socketInstance.on("session_status_changed", (data: { status: any }) => {
      setSessionState((prev) =>
        prev
          ? {
              ...prev,
              session: {
                ...prev.session,
                status: data.status,
              },
            }
          : null,
      );
    });

    // Live Aggregate Analytics Update
    socketInstance.on("results_update", (analytics: any) => {
      setSlideAnalytics(analytics);
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
    (answer: any) => {
      if (!socketRef.current || isHost || !sessionState?.currentSlide) return;

      return new Promise<{ success: boolean }>((resolve, reject) => {
        socketRef.current!.emit(
          "submit_response",
          {
            slideId: sessionState.currentSlide!.id,
            answer,
          },
          (response: any) => {
            if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve({ success: true });
            }
          },
        );
      });
    },
    [isHost, sessionState?.currentSlide],
  );

  return {
    socket,
    connectionStatus,
    sessionState,
    slideAnalytics,
    slideAnalyticsMap,
    error,
    changeSlide,
    toggleVotingLock,
    changeSessionStatus,
    submitResponse,
  };
}
