"use client";

import { useState } from "react";
import { MentiPresentation, MentiSlide, MentiQuestionType } from "~/lib/menti";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";

export function useMentiEditor(initialPresentation: MentiPresentation = MOCK_PRESENTATION) {
  const [presentation, setPresentation] = useState<MentiPresentation>(initialPresentation);
  const [activeSlideId, setActiveSlideId] = useState<string>(
    initialPresentation.slides[0]?.id || ""
  );
  const [isNewSlideModalOpen, setIsNewSlideModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "results">("create");

  const activeSlide =
    presentation.slides.find((s) => s.id === activeSlideId) || presentation.slides[0];

  const updateTitle = (title: string) => {
    setPresentation((prev) => ({ ...prev, title }));
  };

  const updateSlide = (slideId: string, updated: Partial<MentiSlide>) => {
    setPresentation((prev) => ({
      ...prev,
      slides: prev.slides.map((s) => (s.id === slideId ? { ...s, ...updated } : s)),
    }));
  };

  const addSlide = (type: MentiQuestionType) => {
    const newId = `slide-${Date.now()}`;
    const newSlide: MentiSlide = {
      id: newId,
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
      index: presentation.slides.length + 1,
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

    setPresentation((prev) => ({
      ...prev,
      slides: [...prev.slides, newSlide],
    }));
    setActiveSlideId(newId);
    setIsNewSlideModalOpen(false);
  };

  const deleteSlide = (slideId: string) => {
    if (presentation.slides.length <= 1) return;
    const remaining = presentation.slides.filter((s) => s.id !== slideId);
    setPresentation((prev) => ({ ...prev, slides: remaining }));
    if (activeSlideId === slideId) {
      setActiveSlideId(remaining[0]?.id || "");
    }
  };

  const reorderSlides = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const slides = [...presentation.slides];
    const [moved] = slides.splice(fromIdx, 1);
    if (!moved) return;
    const targetIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
    slides.splice(targetIdx, 0, moved);
    setPresentation((prev) => ({ ...prev, slides }));
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
