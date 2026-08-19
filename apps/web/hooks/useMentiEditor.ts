"use client";

import { useState, useRef, useEffect } from "react";
import { MentiPresentation, MentiSlide, MentiQuestionType } from "~/lib/menti";
import { env } from "~/env";
import { toast } from "sonner";

const DEFAULT_INITIAL_PRESENTATION: MentiPresentation = {
  id: "",
  title: "Untitled Menti",
  slug: "untitled-menti",
  joinCode: "------",
  isLive: false,
  activeSlideId: null,
  ownerId: "",
  participantCount: 0,
  slides: [],
  createdAt: "",
  updatedAt: "",
};

export function useMentiEditor(initialPresentation: MentiPresentation = DEFAULT_INITIAL_PRESENTATION) {
  const [presentation, setPresentation] = useState<MentiPresentation>(initialPresentation);
  const [activeSlideId, setActiveSlideId] = useState<string>(
    initialPresentation?.slides?.[0]?.id || ""
  );
  const [isNewSlideModalOpen, setIsNewSlideModalOpen] = useState(false);
  const [isPptxModalOpen, setIsPptxModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "results">("create");

  const updateTitleTimeout = useRef<NodeJS.Timeout | null>(null);
  const updateSlideTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingSlideUpdates = useRef<Record<string, Partial<MentiSlide>>>({});

  const activeSlide =
    presentation.slides.find((s) => s.id === activeSlideId) || presentation.slides[0];

  const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";

  // Clean up timeouts on unmount
  useEffect(() => {
    const slideTimeouts = updateSlideTimeouts.current;
    const titleTimeout = updateTitleTimeout.current;
    return () => {
      if (titleTimeout) clearTimeout(titleTimeout);
      Object.values(slideTimeouts).forEach(clearTimeout);
    };
  }, []);

  const updateTitle = (title: string) => {
    // 1. Optimistic Update
    setPresentation((prev) => ({ ...prev, title }));

    // 2. Debounced API call
    if (updateTitleTimeout.current) clearTimeout(updateTitleTimeout.current);
    updateTitleTimeout.current = setTimeout(async () => {
      try {
        await fetch(`${baseUrl}/api/presentations/${presentation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
          credentials: "include",
        });
      } catch (err) {
        console.error("Failed to sync presentation title:", err);
      }
    }, 1000);
  };

  const updateSlide = (slideId: string, updated: Partial<MentiSlide>) => {
    // 1. Optimistic Update
    setPresentation((prev) => ({
      ...prev,
      slides: prev.slides.map((s) => (s.id === slideId ? { ...s, ...updated } : s)),
    }));

    // If it's a temporary ID, don't attempt to sync yet (it will sync once ID is resolved)
    if (slideId.startsWith("temp-")) return;

    // 2. Accumulate updates to prevent losing fields when debouncing multiple actions
    pendingSlideUpdates.current[slideId] = {
      ...pendingSlideUpdates.current[slideId],
      ...updated,
    };

    // 3. Debounce API call per slideId (reduced to 1s for near-instant responsiveness)
    if (updateSlideTimeouts.current[slideId]) {
      clearTimeout(updateSlideTimeouts.current[slideId]);
    }

    updateSlideTimeouts.current[slideId] = setTimeout(async () => {
      const payload = { ...pendingSlideUpdates.current[slideId] };
      if (!payload) return;
      
      // Clear pending updates for this slide before network call
      delete pendingSlideUpdates.current[slideId];

      // Automatically sync quizSettings with responseSettings if present
      if (payload.responseSettings) {
        payload.quizSettings = {
          timeLimitSeconds: payload.responseSettings.timeToRespondSeconds || 30,
          maxPoints: 1000,
          gradingScheme: payload.responseSettings.scoreAllocation === "fixed" ? "answer_based" : "time_based",
        };
      }

      try {
        await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides/${slideId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
      } catch (err) {
        console.error(`Failed to sync slide ${slideId}:`, err);
      }
    }, 1000);
  };

  const addSlide = async (type: MentiQuestionType) => {
    const tempId = `temp-${Date.now()}`;
    const newSlide: MentiSlide = {
      id: tempId,
      presentationId: presentation.id,
      type,
      question:
        type === "BAR_GRAPH"
          ? "New Multiple Choice Poll"
          : type === "WORD_CLOUD"
            ? "New Word Cloud Question"
            : type === "SCALES"
              ? "New Rating / Scales Question"
              : type === "QUIZ"
                ? "Select the correct answer"
                : type === "LEADERBOARD"
                  ? "Quiz leaderboard"
                  : "Add your heading here",
      description:
        type === "CONTENT"
          ? "Add a subtitle, takeaway, or body text here."
          : type === "QUIZ"
            ? "Choose the correct option"
            : null,
      position: presentation.slides.length,
      options:
        type === "BAR_GRAPH"
          ? [
              { id: "opt-1", label: "Option 1", voteCount: 0 },
              { id: "opt-2", label: "Option 2", voteCount: 0 },
            ]
          : type === "QUIZ"
            ? [
                { id: "q-opt-1", label: "Option 1", isCorrect: true, voteCount: 0, color: "#2d5cf6" },
                { id: "q-opt-2", label: "Option 2", isCorrect: false, voteCount: 0, color: "#ff7378" },
                { id: "q-opt-3", label: "Option 3", isCorrect: false, voteCount: 0, color: "#9189eb" },
              ]
          : type === "SCALES"
            ? [
                { id: "rate-1", label: "1", voteCount: 0 },
                { id: "rate-2", label: "2", voteCount: 0 },
                { id: "rate-3", label: "3", voteCount: 0 },
                { id: "rate-4", label: "4", voteCount: 0 },
                { id: "rate-5", label: "5", voteCount: 0 },
              ]
            : [],
      quizSettings:
        type === "QUIZ"
          ? {
              timeLimitSeconds: 30,
              maxPoints: 1000,
              gradingScheme: "time_based",
            }
          : undefined,
      responseSettings: {
        multipleSelection: false,
        maxEntriesPerParticipant: 1,
        isVotingLocked: false,
        timeToRespondSeconds: type === "QUIZ" ? 30 : undefined,
        scoreAllocation: type === "QUIZ" ? "time_based" : undefined,
        pointsPerQuestion: type === "QUIZ" ? 1000 : undefined,
        addLeaderboard: type === "QUIZ" ? true : undefined,
      },
      designSettings: {
        backgroundColor: "#ffffff",
        textColor: "#17171c",
        accentColor: type === "QUIZ" ? "#2d5cf6" : type === "LEADERBOARD" ? "#e4a23e" : "#e4a23e",
        textAlign: "center",
        icon: "none",
        showLogo: true,
        leaderboardTitle: type === "LEADERBOARD" ? "Quiz leaderboard" : undefined,
        showPodium: type === "LEADERBOARD" ? true : undefined,
      },
    };

    // If type is QUIZ, automatically add a paired LEADERBOARD slide immediately following it
    let leaderboardSlide: MentiSlide | null = null;
    if (type === "QUIZ") {
      const tempLbId = `temp-lb-${Date.now() + 1}`;
      leaderboardSlide = {
        id: tempLbId,
        presentationId: presentation.id,
        type: "LEADERBOARD",
        question: "Quiz leaderboard",
        description: "Live standings and player scores",
        position: presentation.slides.length + 1,
        options: [],
        responseSettings: {
          isVotingLocked: true,
        },
        designSettings: {
          backgroundColor: "#ffffff",
          textColor: "#17171c",
          accentColor: "#e4a23e",
          leaderboardTitle: "Quiz leaderboard",
          showPodium: true,
          showLogo: true,
        },
      };
    }

    const slidesToAdd = leaderboardSlide ? [newSlide, leaderboardSlide] : [newSlide];

    // 1. Optimistic Update
    setPresentation((prev) => ({
      ...prev,
      slides: [...prev.slides, ...slidesToAdd],
    }));
    setActiveSlideId(tempId);
    setIsNewSlideModalOpen(false);

    // 2. Real API call (with graceful offline/mock fallback)
    try {
      const res = await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newSlide.type,
          position: newSlide.position,
          question: newSlide.question,
          description: newSlide.description,
          options: newSlide.options,
          quizSettings: newSlide.quizSettings,
          responseSettings: newSlide.responseSettings,
          designSettings: newSlide.designSettings,
        }),
        credentials: "include",
      });

      if (res.ok) {
        const savedSlide = await res.json();
        const realId = savedSlide.id || savedSlide._id;

        let realLbId: string | null = null;
        if (leaderboardSlide) {
          try {
            const lbRes = await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: leaderboardSlide.type,
                position: leaderboardSlide.position,
                question: leaderboardSlide.question,
                description: leaderboardSlide.description,
                options: leaderboardSlide.options,
                responseSettings: leaderboardSlide.responseSettings,
                designSettings: leaderboardSlide.designSettings,
              }),
              credentials: "include",
            });
            if (lbRes.ok) {
              const savedLb = await lbRes.json();
              realLbId = savedLb.id || savedLb._id;
            }
          } catch (lbErr) {
            console.warn("Backend leaderboard slide sync:", lbErr);
          }
        }

        // Resolve Temp IDs to Real IDs
        setPresentation((prev) => ({
          ...prev,
          slides: prev.slides.map((s) => {
            if (s.id === tempId) return { ...s, id: realId };
            if (leaderboardSlide && s.id === leaderboardSlide.id && realLbId) {
              return { ...s, id: realLbId };
            }
            return s;
          }),
        }));

        setActiveSlideId((current) => (current === tempId ? realId : current));
      } else {
        console.warn(`Slide saved locally (backend returned status ${res.status})`);
      }
    } catch (err) {
      console.warn("Slide saved in local editor mode:", err);
    }
  };

  const toggleQuizLeaderboard = async (quizSlideId: string, enable: boolean) => {
    let leaderboardSlideIdToDelete: string | null = null;
    let newLeaderboardSlideToCreate: MentiSlide | null = null;

    setPresentation((prev) => {
      const quizIdx = prev.slides.findIndex((s) => s.id === quizSlideId);
      if (quizIdx === -1) return prev;

      const quizSlide = prev.slides[quizIdx];
      if (!quizSlide) return prev;

      // 1. Update the quiz slide's addLeaderboard setting
      const updatedQuizSlide: MentiSlide = {
        ...quizSlide,
        responseSettings: {
          ...quizSlide.responseSettings,
          addLeaderboard: enable,
        },
      };

      const slidesCopy = [...prev.slides];
      slidesCopy[quizIdx] = updatedQuizSlide;

      const nextSlide = slidesCopy[quizIdx + 1];

      if (enable) {
        // If next slide is not a LEADERBOARD, insert one right after this quiz
        if (nextSlide?.type !== "LEADERBOARD") {
          const tempLbId = `temp-lb-${Date.now()}`;
          const newLbSlide: MentiSlide = {
            id: tempLbId,
            presentationId: prev.id,
            type: "LEADERBOARD",
            question: "Quiz leaderboard",
            description: "Live standings and player scores",
            position: quizIdx + 1,
            options: [],
            responseSettings: { isVotingLocked: true },
            designSettings: {
              backgroundColor: "#ffffff",
              textColor: "#17171c",
              accentColor: "#e4a23e",
              leaderboardTitle: "Quiz leaderboard",
              showPodium: true,
              showLogo: true,
            },
          };
          newLeaderboardSlideToCreate = newLbSlide;
          slidesCopy.splice(quizIdx + 1, 0, newLbSlide);
        }
      } else {
        // If next slide is a LEADERBOARD, remove it
        if (nextSlide?.type === "LEADERBOARD") {
          leaderboardSlideIdToDelete = nextSlide.id;
          slidesCopy.splice(quizIdx + 1, 1);
        }
      }

      // Re-index position fields
      const reindexed = slidesCopy.map((s, idx) => ({ ...s, position: idx }));
      return {
        ...prev,
        slides: reindexed,
      };
    });

    // Handle asynchronous backend API calls
    if (enable && newLeaderboardSlideToCreate) {
      const lbToCreate: MentiSlide = newLeaderboardSlideToCreate;
      try {
        const lbRes = await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: lbToCreate.type,
            position: lbToCreate.position,
            question: lbToCreate.question,
            description: lbToCreate.description,
            options: lbToCreate.options,
            responseSettings: lbToCreate.responseSettings,
            designSettings: lbToCreate.designSettings,
          }),
          credentials: "include",
        });
        if (lbRes.ok) {
          const savedLb = await lbRes.json();
          const realLbId = savedLb.id || savedLb._id;
          setPresentation((prev) => ({
            ...prev,
            slides: prev.slides.map((s) => (s.id === lbToCreate.id ? { ...s, id: realLbId } : s)),
          }));
        }
      } catch (lbErr) {
        console.warn("Leaderboard slide synced locally:", lbErr);
      }
    } else if (!enable && leaderboardSlideIdToDelete) {
      const idToDelete: string = leaderboardSlideIdToDelete;
      try {
        if (!idToDelete.startsWith("temp-")) {
          await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides/${idToDelete}`, {
            method: "DELETE",
            credentials: "include",
          });
        }
      } catch (delErr) {
        console.warn("Leaderboard slide deleted locally:", delErr);
      }
    }
  };
  const deleteSlide = async (slideId: string) => {
    if (presentation.slides.length <= 1) {
      toast.error("You cannot delete the only remaining slide");
      return;
    }

    const oldSlides = presentation.slides;
    const oldActiveId = activeSlideId;

    const deletedIdx = oldSlides.findIndex((s) => s.id === slideId);
    if (deletedIdx === -1) return;

    const targetSlide = oldSlides[deletedIdx];
    const isQuiz = targetSlide?.type === "QUIZ";
    const nextSlide = oldSlides[deletedIdx + 1];
    const hasSubsequentLeaderboard = isQuiz && nextSlide?.type === "LEADERBOARD";

    let idsToDelete: string[] = [slideId];
    if (hasSubsequentLeaderboard && nextSlide) {
      idsToDelete = [slideId, nextSlide.id];
    }

    // 1. Instantly update visually
    const isLeaderboard = targetSlide?.type === "LEADERBOARD";
    const prevSlide = oldSlides[deletedIdx - 1];

    let updatedSlides = oldSlides.filter((s) => !idsToDelete.includes(s.id));

    if (isLeaderboard && prevSlide?.type === "QUIZ") {
      updatedSlides = updatedSlides.map((s) =>
        s.id === prevSlide.id
          ? {
              ...s,
              responseSettings: {
                ...s.responseSettings,
                addLeaderboard: false,
              },
            }
          : s
      );
    }

    let targetActiveId = activeSlideId;
    if (idsToDelete.includes(activeSlideId)) {
      targetActiveId =
        deletedIdx >= updatedSlides.length
          ? updatedSlides[updatedSlides.length - 1]?.id || ""
          : updatedSlides[deletedIdx]?.id || "";
    }

    setPresentation((prev) => ({
      ...prev,
      slides: updatedSlides.map((s, idx) => ({ ...s, position: idx })),
    }));
    if (targetActiveId) {
      setActiveSlideId(targetActiveId);
    }

    // Flag to determine if the deletion was undone by the user
    let isUndone = false;

    // 2. Show toast with Undo action
    toast("Slide deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          isUndone = true;
          // Restore visual slides
          setPresentation((prev) => ({
            ...prev,
            slides: oldSlides,
          }));
          setActiveSlideId(oldActiveId);
          toast.success("Delete undone");
        },
      },
      duration: 3000,
    });

    // 3. Process the API delete call after 3 seconds unless undone
    setTimeout(async () => {
      if (isUndone) return;

      for (const id of idsToDelete) {
        try {
          if (!id.startsWith("temp-")) {
            await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides/${id}`, {
              method: "DELETE",
              credentials: "include",
            });
          }
        } catch (err) {
          console.warn(`Deleted slide ${id} locally:`, err);
        }
      }
    }, 3000);
  };
  const reorderSlides = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;

    const slides = [...presentation.slides];
    const [moved] = slides.splice(fromIdx, 1);
    if (!moved) return;
    const targetIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
    slides.splice(targetIdx, 0, moved);

    // Re-index position fields
    const updatedSlides = slides.map((s, idx) => ({ ...s, position: idx }));

    // 1. Optimistic Update
    setPresentation((prev) => ({ ...prev, slides: updatedSlides }));

    // 2. Real API call
    try {
      const slideIds = updatedSlides.map((s) => s.id).filter((id) => !id.startsWith("temp-"));
      if (slideIds.length > 0) {
        await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slideIds }),
          credentials: "include",
        });
      }
    } catch (err) {
      console.warn("Reordered slides locally:", err);
    }
  };

  const refreshPresentation = async (targetActivePosition?: number) => {
    try {
      const res = await fetch(`${baseUrl}/api/presentations/${presentation.id}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const mappedData: MentiPresentation = {
        ...data,
        id: data.id || data._id,
        slides: (data.slides || []).map((s: any) => ({
          ...s,
          id: s.id || s._id,
        })),
      };

      setPresentation(mappedData);

      if (typeof targetActivePosition === "number" && mappedData.slides.length > 0) {
        const slideAtPos =
          mappedData.slides.find((s) => s.position === targetActivePosition) ||
          mappedData.slides[targetActivePosition] ||
          mappedData.slides[mappedData.slides.length - 1];
        if (slideAtPos) {
          setActiveSlideId(slideAtPos.id);
        }
      }
    } catch (err) {
      console.warn("Failed to refresh presentation:", err);
    }
  };

  return {
    presentation,
    setPresentation,
    activeSlide,
    activeSlideId,
    setActiveSlideId,
    activeTab,
    setActiveTab,
    isNewSlideModalOpen,
    setIsNewSlideModalOpen,
    isPptxModalOpen,
    setIsPptxModalOpen,
    updateTitle,
    updateSlide,
    addSlide,
    toggleQuizLeaderboard,
    deleteSlide,
    reorderSlides,
    refreshPresentation,
  };
}
