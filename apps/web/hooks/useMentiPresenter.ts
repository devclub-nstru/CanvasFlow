"use client";

import { useState, useEffect, useCallback } from "react";
import { MentiPresentation } from "~/lib/menti";

export function useMentiPresenter(presentation: MentiPresentation) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showQRCode, setShowQRCode] = useState(true);
  const [isVotingLocked, setIsVotingLocked] = useState(false);
  const [reactionsCount, setReactionsCount] = useState(1);
  const [slides, setSlides] = useState(presentation.slides);

  const totalSlides = slides.length;
  const currentSlide = slides[currentSlideIndex] || slides[0];

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleQRCode = useCallback(() => {
    setShowQRCode((prev) => !prev);
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
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        prevSlide();
      } else if (e.key === "q" || e.key === "Q") {
        toggleQRCode();
      } else if (e.key === "l" || e.key === "L") {
        toggleLock();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, toggleQRCode, toggleLock]);

  return {
    currentSlide,
    currentSlideIndex,
    totalSlides,
    showQRCode,
    isVotingLocked,
    reactionsCount,
    nextSlide,
    prevSlide,
    toggleQRCode,
    toggleLock,
    sendReaction,
    setSlideIndex: setCurrentSlideIndex,
  };
}
