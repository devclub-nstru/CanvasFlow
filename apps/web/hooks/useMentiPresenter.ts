"use client";

import { useState, useEffect, useCallback } from "react";
import { MentiPresentation } from "~/lib/menti";

export function useMentiPresenter(presentation: MentiPresentation) {
  // Step 0 is the Intro Joining Screen. Steps 1..totalQuestions are question slides.
  const [currentStep, setCurrentStep] = useState(0);
  const slides = presentation.slides;
  const [showJoinCode, setShowJoinCode] = useState(true);
  const [reactionsCount, setReactionsCount] = useState(1);

  const totalQuestions = slides.length;
  const totalSteps = totalQuestions + 1; // 0 = Intro, 1..totalQuestions = Slides
  const isIntro = currentStep === 0;
  const currentSlideIndex = isIntro ? 0 : currentStep - 1;
  const currentSlide = slides[currentSlideIndex] || slides[0];

  const [isVotingLocked, setIsVotingLocked] = useState(
    currentSlide?.responseSettings?.isVotingLocked ?? false
  );

  // Sync voting lock state when navigating slides
  useEffect(() => {
    if (!isIntro && currentSlide?.responseSettings?.isVotingLocked !== undefined) {
      setIsVotingLocked(currentSlide.responseSettings.isVotingLocked);
    }
  }, [currentStep, isIntro, currentSlide?.responseSettings?.isVotingLocked]);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleJoinCode = useCallback(() => {
    setShowJoinCode((prev) => !prev);
  }, []);

  const toggleLock = useCallback(() => {
    setIsVotingLocked((prev) => !prev);
  }, []);

  const sendReaction = useCallback(() => {
    setReactionsCount((prev) => prev + 1);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        nextStep();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        prevStep();
      } else if (e.key === "c" || e.key === "C") {
        toggleJoinCode();
      } else if (e.key === "l" || e.key === "L") {
        toggleLock();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextStep, prevStep, toggleJoinCode, toggleLock]);

  return {
    isIntro,
    currentStep,
    totalSteps,
    currentSlide,
    currentSlideIndex,
    totalQuestions,
    showJoinCode,
    isVotingLocked,
    reactionsCount,
    nextStep,
    prevStep,
    toggleJoinCode,
    toggleLock,
    sendReaction,
    setStep: setCurrentStep,
  };
}
