import React from "react";

import { cn } from "~/lib/utils";

const HATCH_LIGHT =
  "bg-[repeating-linear-gradient(315deg,_var(--pattern-hatch)_0px,_var(--pattern-hatch)_1px,_transparent_1px,_transparent_10px)] bg-[length:14px_14px]";

const HATCH_DARK =
  "bg-[repeating-linear-gradient(315deg,_rgba(255,255,255,0.09)_0px,_rgba(255,255,255,0.09)_1px,_transparent_1px,_transparent_10px)] bg-[length:14px_14px]";

type ScaleProps = { className?: string };

export const HorizontalScale = ({ className }: ScaleProps) => (
  <div
    aria-hidden
    className={cn("h-6 w-full border-y border-[var(--pattern)] sm:h-10", HATCH_LIGHT, className)}
  />
);

export const VerticalScale = ({ className }: ScaleProps) => (
  <div
    aria-hidden
    className={cn("h-full w-10 border-x border-[var(--pattern)]", HATCH_LIGHT, className)}
  />
);

export const HorizontalScaleDark = ({ className }: ScaleProps) => (
  <div
    aria-hidden
    className={cn("h-6 w-full border-y border-white/10 sm:h-10", HATCH_DARK, className)}
  />
);

export const VerticalScaleDark = ({ className }: ScaleProps) => (
  <div aria-hidden className={cn("h-full w-10 border-x border-white/10", HATCH_DARK, className)} />
);
