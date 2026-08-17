"use client";

import React from "react";
import { Hourglass, Users } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  participantCount?: number;
}

export function AudienceLobbyView({ participantCount = 1 }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 sm:py-10 space-y-4 sm:space-y-5 select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Animated Hourglass Badge */}
      <div className="relative size-16 sm:size-18 rounded-2xl bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center shadow-sm">
        <motion.div
          animate={{
            rotate: [0, 0, 180, 180, 360],
            scale: [1, 0.92, 1, 0.92, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: [0.65, 0, 0.35, 1],
            times: [0, 0.4, 0.5, 0.9, 1],
          }}
          className="flex items-center justify-center"
        >
          <Hourglass className="size-7 sm:size-8 text-(--cf-orange) stroke-[2.2]" />
        </motion.div>

        {/* Pulsing Live Dot */}
        <span className="absolute -top-1.5 -right-1.5 flex size-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--cf-orange) opacity-75" />
          <span className="relative inline-flex rounded-full size-3.5 bg-(--cf-orange) border-2 border-white" />
        </span>
      </div>

      {/* Main Text Content */}
      <div className="space-y-1.5 max-w-xs mx-auto">
        <h3 className="text-xl sm:text-2xl font-bold text-(--cf-ink) tracking-tight">
          You're in!
        </h3>
        <p className="text-xs sm:text-sm text-(--cf-ink-soft) leading-relaxed">
          Waiting for the host to start the presentation. The slide will appear automatically.
        </p>
      </div>

      {/* Participant Pill */}
      {participantCount > 0 && (
        <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-(--cf-ink) font-mono bg-(--cf-cream-2) px-3 py-1 rounded-full border border-(--cf-line-strong)">
          <Users className="size-3.5 text-(--cf-orange)" />
          <span>
            {participantCount} {participantCount === 1 ? "participant" : "participants"} connected
          </span>
        </div>
      )}
    </div>
  );
}
