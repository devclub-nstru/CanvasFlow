"use client";

import React from "react";
import { MentiPresentation } from "~/lib/menti";
import { useMentiEditor } from "~/hooks/useMentiEditor";
import { MentiEditorHeader } from "./MentiEditorHeader";
import { SlideThumbnailSidebar } from "./SlideThumbnailSidebar";
import { SlideCanvasStage } from "./SlideCanvasStage";
import { SlideInspectorPanel } from "./SlideInspectorPanel";
import { NewSlidePickerModal } from "./NewSlidePickerModal";
import { MentiResultsView } from "../results/MentiResultsView";

interface Props {
  initialPresentation?: MentiPresentation;
}

export function MentiEditorLayout({ initialPresentation }: Props) {
  const {
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
  } = useMentiEditor(initialPresentation);

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-white">
      {/* 1. Global Editor Header */}
      <MentiEditorHeader
        presentation={presentation}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onTitleChange={updateTitle}
      />

      {/* 2. Body Switch: Create Tab vs Results Tab */}
      {activeTab === "create" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Slide Thumbnails */}
          <SlideThumbnailSidebar
            slides={presentation.slides}
            activeSlideId={activeSlideId}
            onSelectSlide={setActiveSlideId}
            onOpenNewSlideModal={() => setIsNewSlideModalOpen(true)}
            onDeleteSlide={deleteSlide}
          />

          {/* Center: Interactive Slide Canvas */}
          {activeSlide && (
            <SlideCanvasStage
              slide={activeSlide}
              joinCode={presentation.joinCode}
            />
          )}

          {/* Right: Slide Inspector & Options */}
          {activeSlide && (
            <SlideInspectorPanel
              slide={activeSlide}
              onChange={(updated) => updateSlide(activeSlide.id, updated)}
              onOpenTypePicker={() => setIsNewSlideModalOpen(true)}
            />
          )}
        </div>
      ) : (
        /* Results Tab View (Screenshot 2) */
        <MentiResultsView presentation={presentation} />
      )}

      {/* 3. New Slide Picker Modal (Screenshot 4) */}
      <NewSlidePickerModal
        isOpen={isNewSlideModalOpen}
        onClose={() => setIsNewSlideModalOpen(false)}
        onSelectType={addSlide}
      />
    </div>
  );
}
