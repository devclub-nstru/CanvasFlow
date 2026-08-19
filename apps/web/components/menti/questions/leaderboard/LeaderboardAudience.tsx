"use client";

import React from "react";
import { Crown, Trophy, TrendingUp } from "lucide-react";
import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  onSubmit?: (val: any) => void;
  hasSubmitted?: boolean;
}

const SAMPLE_PLAYERS = [
  { rank: 1, name: "Alex Rivers", score: 2840, isUser: false },
  { rank: 2, name: "You (Participant)", score: 2620, isUser: true },
  { rank: 3, name: "Marcus Chen", score: 2410, isUser: false },
  { rank: 4, name: "Sarah Connor", score: 1980, isUser: false },
  { rank: 5, name: "David Kim", score: 1850, isUser: false },
];

export function LeaderboardAudience({ slide }: Props) {
  const heading = slide.question || "Quiz leaderboard";

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 select-none animate-in fade-in duration-200">
      {/* 1. Personal Score Highlight Card */}
      <div className="cf-panel cf-raised p-5 bg-amber-50/80 border-2 border-amber-500 rounded-2xl text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-mono font-bold uppercase">
          <Trophy className="size-3.5 text-amber-600" />
          <span>{heading}</span>
        </div>

        <div className="pt-1">
          <h2 className="text-3xl font-black text-neutral-900 font-mono tracking-tight">
            #2 Place
          </h2>
          <p className="text-sm font-bold text-neutral-700 mt-0.5">
            2,620 total points
          </p>
        </div>

        <div className="pt-2 border-t border-amber-200/80 flex items-center justify-center gap-2 text-xs font-mono text-emerald-800 font-bold">
          <TrendingUp className="size-3.5 text-emerald-600" />
          <span>+920 pts gained this round!</span>
        </div>
      </div>

      {/* 2. Top Performers List */}
      <div className="cf-panel cf-raised p-4 bg-white rounded-2xl border-2 border-(--cf-line-strong) space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-(--cf-line)">
          <span className="cf-eyebrow text-(--cf-ink)">Top Leaderboard</span>
          <span className="text-[11px] font-mono text-(--cf-ink-soft)">Top 5</span>
        </div>

        <div className="space-y-2">
          {SAMPLE_PLAYERS.map((player) => (
            <div
              key={player.rank}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                player.isUser
                  ? "bg-amber-50 border-amber-400 ring-1 ring-amber-400"
                  : "bg-neutral-50 border-neutral-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`size-6 rounded-md flex items-center justify-center font-mono font-bold text-xs ${
                    player.rank === 1
                      ? "bg-amber-500 text-white"
                      : player.rank === 2
                      ? "bg-slate-400 text-white"
                      : player.rank === 3
                      ? "bg-amber-700 text-white"
                      : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {player.rank === 1 ? <Crown className="size-3.5 fill-current" /> : `#${player.rank}`}
                </span>
                <span
                  className={`text-xs sm:text-sm font-bold truncate max-w-[140px] ${
                    player.isUser ? "text-amber-900" : "text-neutral-800"
                  }`}
                >
                  {player.name}
                </span>
              </div>

              <span className="font-mono font-bold text-xs sm:text-sm text-neutral-900 tabular-nums">
                {player.score.toLocaleString()} pts
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
