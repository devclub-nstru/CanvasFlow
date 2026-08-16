"use client";

import React, { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

interface Props {
  onJoin: (code: string) => void;
}

export function AudienceJoinCard({ onJoin }: Props) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) onJoin(code.trim());
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-sm px-6 mx-auto select-none">
      <div className="flex items-center gap-2 mb-8">
        <div className="flex items-center justify-center w-8 h-8 font-black text-white bg-blue-600 rounded-lg shadow-md">
          CF
        </div>
        <span className="text-xl font-bold text-neutral-900">CanvasFlow Menti</span>
      </div>

      <div className="w-full p-6 bg-white border border-neutral-200 rounded-3xl shadow-xl space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-neutral-900">Join a presentation</h2>
          <p className="text-xs text-neutral-500">
            Enter the 8-digit code shown on the presenter screen
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 8239 2324"
              maxLength={12}
              autoFocus
              required
              className="w-full p-4 text-center font-mono font-bold text-2xl tracking-widest bg-neutral-50 border-2 border-neutral-300 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!code.trim()}
            className="flex items-center justify-center w-full py-4 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-2xl shadow-lg transition-all active:scale-[0.98]"
          >
            Join Presentation
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>No login required</span>
        </div>
      </div>
    </div>
  );
}
