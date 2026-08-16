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

    socketInstance.on("connect_error", (err) => {
      setConnectionStatus("error");
      setError(err.message);
      console.error("[Realtime] Socket connection error:", err.message);
    });

    socketInstance.on("disconnect", () => {
      setConnectionStatus("disconnected");
      console.log("[Realtime] Socket disconnected");
    });

    socketInstance.on("error", (data: { message: string }) => {
      setError(data.message);
      console.error("[Realtime] Error event received:", data.message);
    });

    // Session State Synchronizer
    socketInstance.on("session_state_sync", (state: any) => {
      const mappedSlide = state.currentSlide
        ? {
            ...state.currentSlide,
            id: state.currentSlide.id || state.currentSlide._id,
          }
        : null;

      setSessionState({
        session: {
          ...state.session,
          id: state.session.id || state.session._id,
        },
        participantCount: state.participantCount,
        currentSlide: mappedSlide,
      });
    });

    // Host Analytics Listener
    if (isHost) {
      socketInstance.on("slide_analytics_update", (analytics: any) => {
        if (analytics?.slideId) {
          setSlideAnalytics(analytics);
          setSlideAnalyticsMap((prev) => ({
            ...prev,
            [analytics.slideId]: analytics,
          }));
        }
      });
    }

    return () => {
      socketInstance.disconnect();
    };
  }, [sessionId, token, isHost, disabled]);

  // Host Action: Control Slide
  const changeSlide = useCallback(
    (slideId: string) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit("change_slide", { slideId }, (response: any) => {
        if (response?.error) {
          console.error("[Realtime] Failed to change slide:", response.error);
        }
      });
    },
    [isHost]
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
    [isHost]
  );

  // Host Action: Change Status (live, paused, finished)
  const changeSessionStatus = useCallback(
    async (status: "live" | "paused" | "finished") => {
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
    [isHost]
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
          }
        );
      });
    },
    [isHost, sessionState?.currentSlide]
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
