"use client";

import React from "react";
import { Trophy, TrendingUp, Award } from "lucide-react";
import { MentiSlide, MentiLeaderboardSnapshot } from "~/lib/menti";
import type { QuizResponseResult } from "~/hooks/useMentiRealtime";

interface Props {
  slide: MentiSlide;
  onSubmit?: (val: any) => void;
  hasSubmitted?: boolean;
  leaderboard?: MentiLeaderboardSnapshot | null;
  lastResponseResult?: QuizResponseResult | null;
  participantName?: string;
}

export function LeaderboardAudience({
  slide,
  leaderboard,
  lastResponseResult,
  participantName,
}: Props) {
  const heading = slide.question || slide.designSettings?.leaderboardTitle || "Quiz leaderboard";

  const topPlayers = leaderboard?.topParticipants || [];
  const myNickname =
    participantName ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("menti_participant_name") || sessionStorage.getItem("cf_voter_nickname") || ""
      : "");

  // Find user's position in the top leaderboard
  const myEntryIndex = topPlayers.findIndex(
    (p) => p.nickname?.trim().toLowerCase() === myNickname.trim().toLowerCase()
  );
  const myEntry = myEntryIndex >= 0 ? topPlayers[myEntryIndex] : null;

  const myRank = myEntry?.rank ?? (myEntryIndex >= 0 ? myEntryIndex + 1 : null);
  const myScore = myEntry?.score ?? lastResponseResult?.totalScore ?? 0;
  const myPointsGained = lastResponseResult?.pointsAwarded;

  const hasData = topPlayers.length > 0;

  return (
    <div className="flex flex-col w-full space-y-4 sm:space-y-5 select-none animate-in fade-in duration-200">
      {/* 1. Personal Score Highlight Card */}
      <div className="p-4 sm:p-5 bg-white border-2 border-(--cf-line-strong) cf-raised rounded-2xl text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-(--cf-cream) border border-(--cf-line) text-(--cf-ink) text-xs font-mono font-bold uppercase">
          <Trophy className="w-3.5 h-3.5 text-(--cf-orange)" />
          <span>{heading}</span>
        </div>

        <div className="pt-1">
          <h2 className="text-2xl sm:text-3xl font-black text-(--cf-ink) font-mono tracking-tight">
            {myRank ? `#${myRank} Place` : `${myNickname || "You"}`}
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-(--cf-ink-soft) mt-0.5">
            {myScore.toLocaleString()} total points
          </p>
        </div>

        {Boolean(myPointsGained && myPointsGained > 0) && (
          <div className="pt-2 border-t border-(--cf-line) flex items-center justify-center gap-1.5 text-xs font-mono text-emerald-700 font-bold">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>+{myPointsGained} pts gained this round!</span>
          </div>
        )}
      </div>

      {/* 2. Top Performers List */}
      <div className="p-4 bg-white rounded-2xl border-2 border-(--cf-line-strong) cf-raised space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-(--cf-line)">
          <span className="cf-eyebrow text-(--cf-ink)">Top Leaderboard</span>
          <span className="text-[11px] font-mono text-(--cf-ink-soft)">
            {hasData ? `Top ${topPlayers.length}` : "Standings"}
          </span>
        </div>

        {!hasData ? (
          <div className="py-6 flex flex-col items-center justify-center text-center text-(--cf-ink-soft) space-y-1.5">
            <Award className="size-6 opacity-40" />
            <p className="text-xs">Scores will appear here as quiz responses are submitted.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topPlayers.map((player, index) => {
              const rank = player.rank || index + 1;
              const isMe =
                myNickname &&
                player.nickname?.trim().toLowerCase() === myNickname.trim().toLowerCase();

              return (
                <div
                  key={player.participantId || `p-${index}`}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                    isMe
                      ? "bg-amber-50/80 border-amber-500 ring-1 ring-amber-400"
                      : "bg-(--cf-cream) border-(--cf-line)"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`size-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        rank === 1
                          ? "bg-amber-500 text-white"
                          : rank === 2
                          ? "bg-slate-400 text-white"
                          : rank === 3
                          ? "bg-amber-700 text-white"
                          : "bg-white text-(--cf-ink) border border-(--cf-line)"
                      }`}
                    >
                      #{rank}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-semibold truncate max-w-[160px] ${
                        isMe ? "text-amber-900 font-bold" : "text-(--cf-ink)"
                      }`}
                    >
                      {player.nickname} {isMe && "(You)"}
                    </span>
                  </div>

                  <span className="font-mono font-bold text-xs sm:text-sm text-(--cf-ink) tabular-nums shrink-0">
                    {(player.score || 0).toLocaleString()} pts
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

