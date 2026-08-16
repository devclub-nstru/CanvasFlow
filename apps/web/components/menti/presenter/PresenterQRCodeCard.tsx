"use client";

import React from "react";
import { QrCode, X } from "lucide-react";

interface Props {
  joinCode: string;
  totalResponded?: number;
  totalExpected?: number;
  onClose?: () => void;
}

export function PresenterQRCodeCard({
  joinCode,
  totalResponded = 2,
  totalExpected = 2,
  onClose,
}: Props) {
  return (
    <div className="absolute right-8 top-16 z-20 flex flex-col w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden select-none animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-neutral-400 hover:text-neutral-700 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* QR Code Placeholder / Real Graphic */}
      <div className="p-6 flex flex-col items-center justify-center border-b border-neutral-100">
        <div className="w-44 h-44 bg-neutral-900 rounded-xl p-3 flex flex-col items-center justify-center text-white relative">
          <QrCode className="w-36 h-36 text-white" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center font-black text-xs text-white shadow-md">
              CF
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Join at
          </p>
          <p className="text-base font-bold text-neutral-800">menti.com</p>
          <p className="mt-1 text-2xl font-black tracking-widest text-neutral-900 font-mono">
            {joinCode}
          </p>
        </div>
      </div>

      {/* Respondent Progress */}
      <div className="p-4 bg-neutral-50/80 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
          <span>
            {totalResponded} of {totalExpected} responded
          </span>
        </div>
        <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{
              width: `${totalExpected > 0 ? (totalResponded / totalExpected) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
