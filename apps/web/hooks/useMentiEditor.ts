"use client";

import { useState, useRef, useEffect } from "react";
import { MentiPresentation, MentiSlide, MentiQuestionType } from "~/lib/menti";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";
import { env } from "~/env";

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
    return () => {
      if (updateTitleTimeout.current) clearTimeout(updateTitleTimeout.current);
      Object.values(updateSlideTimeouts.current).forEach(clearTimeout);
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
              : "Thank you!",
      description:
        type === "CONTENT"
          ? "We appreciate your feedback and participation."
          : null,
      position: presentation.slides.length,
      options:
        type === "BAR_GRAPH"
          ? [
              { id: "opt-1", label: "Option 1", voteCount: 0 },
              { id: "opt-2", label: "Option 2", voteCount: 0 },
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
      responseSettings: {
        multipleSelection: false,
        maxEntriesPerParticipant: 1,
        isVotingLocked: false,
      },
      designSettings: {
        backgroundColor: "#ffffff",
        textColor: "#1a1d29",
        accentColor: "#2d5cf6",
        showLogo: true,
      },
    };

    // 1. Optimistic Update
    setPresentation((prev) => ({
      ...prev,
      slides: [...prev.slides, newSlide],
    }));
    setActiveSlideId(tempId);
    setIsNewSlideModalOpen(false);

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
    } catch (err) {
      console.error("Failed to add slide to backend:", err);
      // Revert optimistic update on failure
      setPresentation((prev) => ({
        ...prev,
        slides: prev.slides.filter((s) => s.id !== tempId),
      }));
    }
  };

  const deleteSlide = async (slideId: string) => {
    if (presentation.slides.length <= 1) return;
    
    // Remember current slides for fallback
    const originalSlides = [...presentation.slides];
    const deletedIdx = presentation.slides.findIndex((s) => s.id === slideId);
    const remaining = presentation.slides.filter((s) => s.id !== slideId);

    // 1. Optimistic Update
    setPresentation((prev) => ({ ...prev, slides: remaining }));
    
    if (activeSlideId === slideId) {
      // If deleting the last slide, jump to the previous slide; otherwise, jump to the next one
      const targetActiveId = deletedIdx === remaining.length 
        ? remaining[deletedIdx - 1]?.id 
        : remaining[deletedIdx]?.id;
      
      setActiveSlideId(targetActiveId || "");
    }

    // 2. Real API call
    try {
      const res = await fetch(`${baseUrl}/api/presentations/${presentation.id}/slides/${slideId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete slide");
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
  };
}
