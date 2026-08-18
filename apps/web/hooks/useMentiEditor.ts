"use client";

import { useState, useRef, useEffect } from "react";
import { MentiOption, MentiPresentation, MentiSlide, MentiQuestionType } from "~/lib/menti";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";
import { env } from "~/env";

/** Starting question text for each slide type. */
const DEFAULT_QUESTION: Record<MentiQuestionType, string> = {
  BAR_GRAPH: "New Multiple Choice Poll",
  WORD_CLOUD: "New Word Cloud Question",
  SCALES: "New Rating / Scales Question",
  RANKING: "Rank these in order",
  QUIZ: "Which of these is correct?",
  LEADERBOARD: "Leaderboard",
  CONTENT: "Add your heading here",
};

/**
 * A leaderboard slide is created automatically after each quiz slide and belongs
 * to it. `isSlideLocked` reports that pairing so the UI can refuse a direct
 * delete; removing the quiz removes both.
 */
export function isSlideLocked(slides: MentiSlide[], slideId: string): boolean {
  const index = slides.findIndex((slide) => slide.id === slideId);
  if (index <= 0) return false;
  if (slides[index]!.type !== "LEADERBOARD") return false;
  return slides[index - 1]!.type === "QUIZ";
}

/** The leaderboard paired with `slideId`, if that slide is a quiz. */
function pairedLeaderboardId(slides: MentiSlide[], slideId: string): string | null {
  const index = slides.findIndex((slide) => slide.id === slideId);
  if (index === -1 || slides[index]!.type !== "QUIZ") return null;
  const next = slides[index + 1];
  return next && next.type === "LEADERBOARD" ? next.id : null;
}

/** Starting options for each slide type; types without options get none. */
const DEFAULT_OPTIONS: Partial<Record<MentiQuestionType, MentiOption[]>> = {
  BAR_GRAPH: [
    { id: "opt-1", label: "Option 1", voteCount: 0 },
    { id: "opt-2", label: "Option 2", voteCount: 0 },
  ],
  SCALES: [
    { id: "rate-1", label: "1", voteCount: 0 },
    { id: "rate-2", label: "2", voteCount: 0 },
    { id: "rate-3", label: "3", voteCount: 0 },
    { id: "rate-4", label: "4", voteCount: 0 },
    { id: "rate-5", label: "5", voteCount: 0 },
  ],
  RANKING: [
    { id: "rank-1", label: "Item 1", voteCount: 0 },
    { id: "rank-2", label: "Item 2", voteCount: 0 },
    { id: "rank-3", label: "Item 3", voteCount: 0 },
    { id: "rank-4", label: "Item 4", voteCount: 0 },
  ],
  // The first answer starts marked correct — a quiz with nothing correct scores
  // zero for everyone, so the safe default is a working question.
  QUIZ: [
    { id: "quiz-1", label: "Answer 1", isCorrect: true, voteCount: 0 },
    { id: "quiz-2", label: "Answer 2", isCorrect: false, voteCount: 0 },
    { id: "quiz-3", label: "Answer 3", isCorrect: false, voteCount: 0 },
    { id: "quiz-4", label: "Answer 4", isCorrect: false, voteCount: 0 },
  ],
};

/** Response settings a type needs beyond the shared defaults. */
const DEFAULT_RESPONSE_SETTINGS: Partial<Record<MentiQuestionType, Record<string, unknown>>> = {
  QUIZ: { countdownSeconds: 5, timeLimitSeconds: 20, basePoints: 1000 },
};

export function useMentiEditor(initialPresentation: MentiPresentation = MOCK_PRESENTATION) {
  const [presentation, setPresentation] = useState<MentiPresentation>(initialPresentation);
  const [activeSlideId, setActiveSlideId] = useState<string>(
    initialPresentation?.slides?.[0]?.id || ""
  );
  const [isNewSlideModalOpen, setIsNewSlideModalOpen] = useState(false);
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
      const payload = pendingSlideUpdates.current[slideId];
      if (!payload) return;
      
      // Clear pending updates for this slide before network call
      delete pendingSlideUpdates.current[slideId];

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

  /** Create one slide optimistically, then persist it. Returns its real id. */
  const createSlide = async (
    type: MentiQuestionType,
    position: number,
    { focus }: { focus: boolean },
  ): Promise<string | null> => {
    const tempId = `temp-${type}-${Date.now()}-${position}`;
    const newSlide: MentiSlide = {
      id: tempId,
      presentationId: presentation.id,
      type,
      question: DEFAULT_QUESTION[type],
      description:
        type === "CONTENT"
          ? "Add a subtitle, takeaway, or body text here."
          : null,
      position,
      // Clone so the shared defaults are never mutated by later edits.
      options: (DEFAULT_OPTIONS[type] ?? []).map((option) => ({ ...option })),
      responseSettings: {
        multipleSelection: false,
        maxEntriesPerParticipant: 1,
        isVotingLocked: false,
        ...(DEFAULT_RESPONSE_SETTINGS[type] ?? {}),
      },
      designSettings: {
        backgroundColor: "#ffffff",
        textColor: "#17171c",
        accentColor: "#e4a23e",
        textAlign: "center",
        icon: "none",
        showLogo: true,
      },
    };

    // 1. Optimistic Update
    setPresentation((prev) => ({
      ...prev,
      slides: [...prev.slides, newSlide],
    }));
    if (focus) setActiveSlideId(tempId);

    // 2. Real API call
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
          responseSettings: newSlide.responseSettings,
          designSettings: newSlide.designSettings,
        }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to save slide");
      const savedSlide = await res.json();
      const realId = savedSlide.id || savedSlide._id;

      // 3. Resolve Temp ID to Real ID
      setPresentation((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === tempId ? { ...s, id: realId } : s
        ),
      }));
      
      setActiveSlideId((current) => (current === tempId ? realId : current));
      return realId as string;
    } catch (err) {
      console.error("Failed to add slide to backend:", err);
      // Revert optimistic update on failure
      setPresentation((prev) => ({
        ...prev,
        slides: prev.slides.filter((s) => s.id !== tempId),
      }));
      return null;
    }
  };

  const addSlide = async (type: MentiQuestionType) => {
    setIsNewSlideModalOpen(false);

    const basePosition = presentation.slides.length;
    const createdId = await createSlide(type, basePosition, { focus: true });

    /*
     * Every quiz is followed by its own leaderboard, so the standings are part
     * of the deck rather than something to remember to add. Focus stays on the
     * quiz, which is the slide the user actually came to write.
     */
    if (createdId && type === "QUIZ") {
      await createSlide("LEADERBOARD", basePosition + 1, { focus: false });
    }
  };

  const changeSlideType = (slideId: string, newType: MentiQuestionType) => {
    const targetSlide = presentation.slides.find((s) => s.id === slideId);
    if (!targetSlide || targetSlide.type === newType) return;

    const defaultQuestions = [
      "New Multiple Choice Poll",
      "New Word Cloud Question",
      "New Rating / Scales Question",
      "Add your heading here",
    ];
    const isDefaultQuestion =
      !targetSlide.question || defaultQuestions.includes(targetSlide.question.trim());

    const question = isDefaultQuestion
      ? newType === "BAR_GRAPH"
        ? "New Multiple Choice Poll"
        : newType === "WORD_CLOUD"
        ? "New Word Cloud Question"
        : newType === "SCALES"
        ? "New Rating / Scales Question"
        : "Add your heading here"
      : targetSlide.question;

    const description =
      newType === "CONTENT"
        ? targetSlide.description || "Add a subtitle, takeaway, or body text here."
        : null;

    let options = targetSlide.options;
    if (newType === "BAR_GRAPH") {
      if (!options || options.length === 0 || targetSlide.type === "SCALES") {
        options = [
          { id: "opt-1", label: "Option 1", voteCount: 0 },
          { id: "opt-2", label: "Option 2", voteCount: 0 },
          { id: "opt-3", label: "Option 3", voteCount: 0 },
        ];
      }
    } else if (newType === "SCALES") {
      options = [
        { id: "rate-1", label: "1", voteCount: 0 },
        { id: "rate-2", label: "2", voteCount: 0 },
        { id: "rate-3", label: "3", voteCount: 0 },
        { id: "rate-4", label: "4", voteCount: 0 },
        { id: "rate-5", label: "5", voteCount: 0 },
      ];
    } else if (newType === "WORD_CLOUD" || newType === "CONTENT") {
      options = [];
    }

    const responseSettings = {
      ...targetSlide.responseSettings,
      multipleSelection: false,
      maxEntriesPerParticipant: newType === "WORD_CLOUD" ? 1 : undefined,
      minRating: newType === "SCALES" ? 1 : undefined,
      maxRating: newType === "SCALES" ? 5 : undefined,
    };

    updateSlide(slideId, {
      type: newType,
      question,
      description,
      options,
      responseSettings,
    });
  };

  const deleteSlide = async (slideId: string) => {
    if (presentation.slides.length <= 1) return;

    // A leaderboard belongs to the quiz before it and cannot be removed alone.
    if (isSlideLocked(presentation.slides, slideId)) return;

    /*
     * Deleting a quiz takes its paired leaderboard with it. Leaving the
     * leaderboard behind would strand a slide that is no longer locked but no
     * longer means anything either.
     */
    const pairedId = pairedLeaderboardId(presentation.slides, slideId);
    const idsToDelete = pairedId ? [slideId, pairedId] : [slideId];

    // Never empty the deck.
    if (presentation.slides.length <= idsToDelete.length) return;

    // Remember current slides for fallback
    const originalSlides = [...presentation.slides];
    const deletedIdx = presentation.slides.findIndex((s) => s.id === slideId);
    const remaining = presentation.slides.filter((s) => !idsToDelete.includes(s.id));

    // 1. Optimistic Update
    setPresentation((prev) => ({
      ...prev,
      slides: prev.slides.filter((s) => !idsToDelete.includes(s.id)),
    }));

    if (idsToDelete.includes(activeSlideId)) {
      // Land on the slide that took this one's place, or the last one if we
      // deleted from the end.
      const targetActiveId =
        deletedIdx >= remaining.length
          ? remaining[remaining.length - 1]?.id
          : remaining[deletedIdx]?.id;

      setActiveSlideId(targetActiveId || "");
    }

    // 2. Real API call
    try {
      for (const id of idsToDelete) {
        const res = await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to delete slide");
      }
    } catch (err) {
      console.error(`Failed to delete slide ${slideId}:`, err);
      // Revert on error
      setPresentation((prev) => ({ ...prev, slides: originalSlides }));
      setActiveSlideId(slideId);
    }
  };

  const reorderSlides = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    
    const originalSlides = [...presentation.slides];
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
      const slideIds = updatedSlides.map((s) => s.id);
      const res = await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reorder slides");
    } catch (err) {
      console.error("Failed to reorder slides in backend:", err);
      // Revert on error
      setPresentation((prev) => ({ ...prev, slides: originalSlides }));
    }
  };

  return {
    presentation,
    activeSlide,
    activeSlideId,
    setActiveSlideId,
    activeTab,
    setActiveTab,
    isNewSlideModalOpen,
    setIsNewSlideModalOpen,
    updateTitle,
    updateSlide,
    addSlide,
    deleteSlide,
    reorderSlides,
    changeSlideType,
  };
}
