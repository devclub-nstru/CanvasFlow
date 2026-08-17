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
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(true);
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
    reorderSlides,
  } = useMentiEditor(initialPresentation);

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-(--cf-cream)">
      {/* 1. Global Editor Header */}
      <MentiEditorHeader
        presentation={presentation}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onTitleChange={updateTitle}
      />

      {/* 2. Main Builder Layout: Create Tab vs Results Tab */}
      {activeTab === "create" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Slide Thumbnails Sidebar with Drag-and-Drop Reordering */}
          <SlideThumbnailSidebar
            slides={presentation.slides}
            activeSlideId={activeSlideId}
            onSelectSlide={setActiveSlideId}
            onOpenNewSlideModal={() => setIsNewSlideModalOpen(true)}
            onDeleteSlide={deleteSlide}
            onReorderSlide={reorderSlides}
          />

          {/* Center Interactive Presentation Stage */}
          <SlideCanvasStage
            slide={activeSlide}
            joinCode={presentation.joinCode}
            isInspectorOpen={isInspectorOpen}
            onOpenNewSlideModal={() => setIsNewSlideModalOpen(true)}
            onChange={activeSlide ? (updated) => updateSlide(activeSlide.id, updated) : undefined}
          />

          {/* Right Inspector Drawer */}
          {activeSlide && (
            <SlideInspectorPanel
              slide={activeSlide}
              isOpen={isInspectorOpen}
              onToggleOpen={() => setIsInspectorOpen((prev) => !prev)}
              onChange={(updated) => updateSlide(activeSlide.id, updated)}
              onOpenTypePicker={() => setIsNewSlideModalOpen(true)}
            />
          )}
        </div>
      ) : (
        /* Results Analytics View */
        <MentiResultsView presentation={presentation} />
      )}

      {/* 3. New Slide Type Picker Modal */}
      <NewSlidePickerModal
        isOpen={isNewSlideModalOpen}
        onClose={() => setIsNewSlideModalOpen(false)}
        onSelectType={addSlide}
      />
    </div>
  );
}
