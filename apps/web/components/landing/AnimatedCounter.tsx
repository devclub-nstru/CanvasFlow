"use client";

import { useAnimatedCounter } from '~/hooks/useAnimatedCounter';
import { useScrollReveal } from '~/hooks/useScrollReveal';

export function AnimatedCounter({
  value,
  suffix = '',
  label,
}: {
  value: number;
  suffix?: string;
  label: string;
}) {
  const { ref, isVisible } = useScrollReveal(0.3);
  const count = useAnimatedCounter(value, 1800, isVisible);

  return (
    <div ref={ref} className="flex flex-col items-center justify-center">
      <span className="text-5xl md:text-7xl font-black tracking-tighter mb-2">
        {count.toLocaleString()}{suffix}
      </span>
      <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">
        {label}
      </span>
    </div>
  );
}