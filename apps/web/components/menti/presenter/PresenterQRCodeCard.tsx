"use client";

import React from "react";
import { QrCode, X, Users } from "lucide-react";

interface Props {
  joinCode: string;
  totalResponded?: number;
  totalExpected?: number;
  onClose?: () => void;
}

export function PresenterQRCodeCard({
  joinCode,
  totalResponded = 0,
  totalExpected = 0,
  onClose,
}: Props) {
  return (
    <div className="absolute right-8 top-16 z-30 flex flex-col w-72 bg-white rounded-2xl border-2 border-(--cf-line-strong) cf-raised overflow-hidden select-none animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Card Header */}
      <div className="cf-pane-bar px-4 flex items-center justify-between border-b border-(--cf-line-strong) bg-(--cf-cream-2)">
        <span className="cf-eyebrow text-(--cf-ink)">Audience Join PIN</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="cf-danger-ghost p-1 rounded"
            title="Close QR Code"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* QR Code Container */}
      <div className="p-5 flex flex-col items-center justify-center bg-white space-y-4">
        <div className="size-44 bg-(--cf-cream) rounded-xl p-2 flex flex-col items-center justify-center relative border-2 border-(--cf-line-strong) cf-raised">
          <QrCode className="w-full h-full text-(--cf-ink) stroke-[1.5]" />
          {/* CanvasFlow Center Logo Badge */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-8 bg-(--cf-ink) rounded-md flex items-center justify-center font-black text-xs text-(--cf-cream) shadow-md border-2 border-white">
              CF
            </div>
          </div>
        </div>

        {/* Join URL & Code */}
        <div className="text-center space-y-1 w-full">
          <p className="cf-meta text-[11px] text-(--cf-ink-soft)">
            Go to <strong className="text-(--cf-orange)">canvasflow.dittya.dev/menti/join</strong>
          </p>
          <div className="p-2 bg-(--cf-cream-2) border border-(--cf-line-strong) rounded-(--hex-radius) text-center">
            <p className="text-xl font-black tracking-widest text-(--cf-ink) font-mono">
              {joinCode}
            </p>
          </div>
        </div>
      </div>

      {/* Respondent Status Footer */}
      <div className="p-3 bg-(--cf-cream-2) border-t border-(--cf-line-strong)">
        {totalResponded === 0 ? (
          <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-white rounded-(--hex-radius) border border-(--cf-line-strong) text-xs font-semibold text-(--cf-ink)">
            <span className="size-2 rounded-full bg-(--cf-orange) animate-pulse" />
            <span className="cf-meta text-[11px]">Waiting for participants</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-(--cf-ink)">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-(--cf-orange)" />
                <span>{totalResponded} responded</span>
              </span>
              <span className="cf-meta text-[10px] text-(--cf-ink-soft)">
                Target: {totalExpected || totalResponded}
              </span>
            </div>
            <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-(--cf-line-strong)">
              <div
                className="h-full bg-(--cf-orange) transition-all duration-300"
                style={{
                  width: `${totalExpected > 0 ? (totalResponded / totalExpected) * 100 : 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
