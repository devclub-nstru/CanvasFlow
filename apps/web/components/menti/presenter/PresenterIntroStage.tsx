"use client";

import React, { useState } from "react";
import { QrCode, Users, ArrowRight, Copy, Check } from "lucide-react";

interface Props {
  title: string;
  joinCode: string;
  participantCount?: number;
  onStart: () => void;
}

export function PresenterIntroStage({
  title,
  joinCode,
  participantCount = 0,
  onStart,
}: Props) {
  const [copied, setCopied] = useState(false);

  const cleanCode = joinCode ? joinCode.replace(/\s+/g, "") : "";
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const joinUrl = `${origin}/menti/join?code=${cleanCode}`;
  const qrImageUrl = cleanCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(joinUrl)}&color=1a1d29&bgcolor=ffffff`
    : null;

  const handleCopyCode = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-5xl mx-auto px-6 py-6 sm:py-8 select-none text-center">
      {/* 1. Presentation Title */}
      <div className="space-y-1.5 max-w-3xl">
        <span className="cf-eyebrow text-(--cf-orange)">CanvasFlow Interactive</span>
        <h1 className="cf-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-(--cf-ink) tracking-tight leading-tight">
          {title || "Untitled Presentation"}
        </h1>
      </div>

      {/* 2. Structured Central Join Column (QR with matching Code box directly below) */}
      <div className="flex flex-col items-center gap-3 my-auto">
        {/* Join URL Instruction */}
        <p className="text-base sm:text-lg md:text-xl font-bold text-(--cf-ink)">
          Go to{" "}
          <span className="text-(--cf-orange) underline underline-offset-4 decoration-2">
            menti.com
          </span>
        </p>

        {/* Big Sharp Live QR Code */}
        <div className="size-56 sm:size-64 md:size-72 bg-white rounded-2xl p-3.5 sm:p-4 flex items-center justify-center relative border-2 border-(--cf-line-strong) cf-raised shrink-0 shadow-lg overflow-hidden group">
          {qrImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrImageUrl}
              alt={`QR Code for ${joinUrl}`}
              className="w-full h-full object-contain select-none"
            />
          ) : (
            <QrCode className="w-full h-full text-(--cf-ink) stroke-[1.5]" />
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-9 bg-(--cf-ink) rounded-md flex items-center justify-center font-black text-xs text-(--cf-cream) shadow-md border-2 border-white">
              CF
            </div>
          </div>
        </div>

        {/* Clickable Code Box Directly Below QR */}
        <button
          type="button"
          onClick={handleCopyCode}
          className="w-56 sm:w-64 md:w-72 p-2.5 sm:p-3 bg-white hover:bg-(--cf-cream) border-2 border-(--cf-line-strong) rounded-(--hex-radius) cf-raised cf-press text-center shadow-md cursor-pointer transition-all group relative"
          title="Click to copy code"
        >
          <p className="cf-meta text-[10px] sm:text-[11px] text-(--cf-ink-soft) font-bold uppercase tracking-widest mb-0.5 flex items-center justify-center gap-1">
            <span>{copied ? "Copied to clipboard!" : "Use Code (click to copy)"}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : (
              <Copy className="w-3 h-3 text-(--cf-ink-soft) group-hover:text-(--cf-orange)" />
            )}
          </p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black tracking-widest text-(--cf-ink) font-mono tabular-nums">
            {joinCode}
          </p>
        </button>

        {/* Connected Participant Status */}
        <div className="flex items-center gap-2 pt-1 text-xs sm:text-sm font-semibold text-(--cf-ink-soft)">
          {participantCount > 0 ? (
            <span className="flex items-center gap-1.5 text-(--cf-ink)">
              <Users className="w-4 h-4 text-(--cf-orange)" />
              <span>{participantCount} participants connected</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-(--cf-orange) animate-pulse" />
              <span>Waiting for participants to join...</span>
            </span>
          )}
        </div>
      </div>

      {/* 3. Bottom Prompt to Start */}
      <button
        type="button"
        onClick={onStart}
        className="cf-btn cf-raised cf-press px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 rounded-(--hex-radius)"
      >
        <span>Press Next or Space to begin</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
