"use client";

import React from "react";
import Image from "next/image";
import { motion } from "motion/react";

/**
 * "Cut form drop-off by 40% or more" — a Daylight-style cream-paper section
 * built as a 3x2 image-and-empty-cell grid, with the headline centered in the
 * top-middle cell.
 *
 * On scroll:
 *  - The eyebrow + first headline line ("Cut form drop-off") fade in first.
 *  - The second line ("by 40% or more") fades in after a short delay.
 *  - The two photo cells slide in from their outer edges.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function CutDropOff() {
  return (
    <section id="story" className="relative bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)]">
      <div className="relative mx-auto w-full max-w-[1320px] px-0">
        {/* horizontal divider line at the top, like Daylight */}
        <div className="absolute inset-x-4 sm:inset-x-6 md:inset-x-8 top-0 h-px bg-[color:var(--cf-line)]" />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-0 border-t border-[color:var(--cf-line)]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
        >
          {/* row 1, col 1: empty cream cell (desktop spacer) */}
          <div className="hidden md:block aspect-[4/3] border-r border-b border-[color:var(--cf-line)]" />

          {/* row 1, col 2: headline */}
          <div className="aspect-[4/3] md:border-r border-b border-[color:var(--cf-line)] flex flex-col items-center justify-center text-center px-6 sm:px-8">
            <motion.p
              className="cf-eyebrow text-[color:var(--cf-ink-soft)]"
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: EASE },
                },
              }}
            >
              Save
            </motion.p>
            <h2 className="mt-4 sm:mt-5 cf-display text-[30px] sm:text-[40px] md:text-[46px] leading-[1.04]">
              <motion.span
                className="block"
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.7, ease: EASE },
                  },
                }}
              >
                Cut form drop-off
              </motion.span>
              <motion.span
                className="block"
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.8, ease: EASE, delay: 0.35 },
                  },
                }}
              >
                by 40% or more
              </motion.span>
            </h2>
          </div>

          {/* row 1, col 3: hero image (slides in from the right) */}
          <motion.div
            className="relative aspect-[4/3] md:border-b border-[color:var(--cf-line)] overflow-hidden"
            variants={{
              hidden: { opacity: 0, x: 60 },
              visible: {
                opacity: 1,
                x: 0,
                transition: { duration: 0.9, ease: EASE },
              },
            }}
          >
            <Image
              src="/new-image-1.png"
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover"
            />
          </motion.div>

          {/* row 2, col 1: image (slides in from the left) */}
          <motion.div
            className="relative aspect-[4/3] md:border-r border-[color:var(--cf-line)] overflow-hidden"
            variants={{
              hidden: { opacity: 0, x: -60 },
              visible: {
                opacity: 1,
                x: 0,
                transition: { duration: 0.9, ease: EASE, delay: 0.1 },
              },
            }}
          >
            <Image
              src="/new-image-2.png"
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover"
            />
          </motion.div>

          {/* row 2, col 2: empty */}
          <div className="hidden md:block aspect-[4/3] border-r border-[color:var(--cf-line)]" />

          {/* row 2, col 3: empty */}
          <div className="hidden md:block aspect-[4/3]" />
        </motion.div>
      </div>
    </section>
  );
}
