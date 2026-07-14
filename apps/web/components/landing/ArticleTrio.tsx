"use client";

import React from "react";
import Image from "next/image";
import { motion } from "motion/react";

/**
 * Story section — Daylight's three-up "why / risks / one at a time" row,
 * reframed for CanvasFlow.
 *
 * - This is the anchor target for the nav's "Story" link (`id="story"`).
 * - Cards stagger in on scroll: each image rises and fades, the eyebrow +
 *   body slide up a beat behind it.
 */
const ARTICLES = [
  {
    eyebrow: "Why CanvasFlow",
    body: "Most form tools force a tradeoff between a tidy linear builder and the messy reality of branching logic. CanvasFlow keeps both in one warm, visual canvas.",
    img: "/new-image-4.png",
  },
  {
    eyebrow: "The brittle stack",
    body: "Renaming a field shouldn't break your webhooks. CanvasFlow locks every field to an immutable key the moment it's created, so your data layer stays stable forever.",
    img: "/new-image-5.png",
  },
  {
    eyebrow: "One form at a time",
    body: "Every published form makes the studio more useful: shared field templates, reusable answer routes, and analytics that compound across your projects.",
    img: "/new-image-6.png",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function ArticleTrio() {
  return (
    <section className="relative bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)]">
      <div className="mx-auto w-full max-w-[1320px] px-0 border-t border-[color:var(--cf-line)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {ARTICLES.map((a, i) => (
            <motion.article
              key={a.eyebrow}
              className={`relative px-6 sm:px-10 py-12 sm:py-16 lg:py-20 ${
                i < ARTICLES.length - 1
                  ? "border-b md:border-b-0 md:border-r border-[color:var(--cf-line)]"
                  : ""
              }`}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={{
                hidden: {},
                visible: {
                  transition: { staggerChildren: 0.1, delayChildren: i * 0.12 },
                },
              }}
            >
              {/* image */}
              <motion.div
                className="relative w-full aspect-[5/4] overflow-hidden rounded-[10px] ring-1 ring-[color:var(--cf-line)] bg-[#dac8ab]"
                variants={{
                  hidden: { opacity: 0, y: 40, scale: 0.98 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.8, ease: EASE },
                  },
                }}
              >
                <Image
                  src={a.img}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover"
                />
              </motion.div>

              {/* heading */}
              <motion.h3
                className="mt-6 cf-display text-[28px] sm:text-[32px] leading-tight"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.7, ease: EASE },
                  },
                }}
              >
                {a.eyebrow}
              </motion.h3>

              {/* body */}
              <motion.p
                className="mt-3 text-[14.5px] leading-relaxed text-[color:var(--cf-ink-soft)] max-w-sm"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.7, ease: EASE },
                  },
                }}
              >
                {a.body}
              </motion.p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
