"use client";

import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  isPreview?: boolean;
}

const colors = ["#5268e8", "#ff7378", "#313c8e", "#9189eb", "#43b7a6", "#e4a23e"];

export function BarGraphViewer({ slide, isPreview }: Props) {
  const options = slide.options;
  const totalVotes = options.reduce((total, option) => total + (option.voteCount || 0), 0);
  const maxVotes = Math.max(1, ...options.map((option) => option.voteCount || 0));
  const textColor = slide.designSettings.textColor || "#17171c";
  const hasResults = totalVotes > 0;

  return (
    <section className="flex h-full w-full flex-col px-[4%] py-[3%]" style={{ color: textColor }}>
      <h2 className={`max-w-[95%] font-medium leading-[1.08] tracking-[-0.045em] ${isPreview ? "text-3xl" : "text-5xl md:text-7xl"}`}>
        {slide.question || "Which of these..."}
      </h2>
      <div className={`mt-auto grid min-h-0 grid-cols-2 gap-x-4 gap-y-5 pt-10 sm:grid-cols-3 lg:grid-cols-4 ${hasResults ? "h-[70%] items-end" : ""}`}>
        {options.map((option, index) => {
          const count = option.voteCount || 0;
          const value = slide.responseSettings.showResultsAsPercentage
            ? `${totalVotes ? Math.round((count / totalVotes) * 100) : 0}%`
            : count;
          const fill = totalVotes ? Math.max(8, (count / maxVotes) * 100) : 3;

          return (
            <article key={option.id} className={`flex min-w-0 flex-col ${hasResults ? "h-full justify-end" : ""}`}>
              <p className={`font-medium tracking-[-0.04em] ${isPreview ? "text-xl" : "text-4xl md:text-5xl"}`}>{value}</p>
              <div className={`mt-3 overflow-hidden bg-neutral-100 ${hasResults ? "flex flex-1 flex-col rounded-t-[28px]" : "h-2 rounded-full"}`}>
                <div
                  className={`transition-all duration-700 ease-out ${hasResults ? "mt-auto w-full rounded-t-[28px]" : "h-full rounded-full"}`}
                  style={hasResults ? { height: `${fill}%`, backgroundColor: option.color || colors[index % colors.length] } : { width: `${fill}%`, backgroundColor: option.color || colors[index % colors.length] }}
                />
              </div>
              <p className={`mt-3 truncate font-medium text-neutral-500 ${isPreview ? "text-base" : "text-xl md:text-2xl"}`} title={option.label}>
                {option.label || `Option ${index + 1}`}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
