import React from "react";

export const AVATAR_PRESETS = [
  "glyph-01",
  "glyph-02",
  "glyph-03",
  "glyph-04",
  "glyph-05",
  "glyph-06",
  "glyph-07",
  "glyph-08",
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export function isAvatarPreset(value: string | null | undefined): value is AvatarPreset {
  return !!value && (AVATAR_PRESETS as readonly string[]).includes(value);
}

export function avatarSeed(user: { id?: string | null; email?: string | null } | null | undefined) {
  return user?.id ?? user?.email ?? "canvasflow";
}

function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function resolvePreset(image: string | null | undefined, seed: string): AvatarPreset {
  if (isAvatarPreset(image)) return image;
  return AVATAR_PRESETS[hash(seed) % AVATAR_PRESETS.length]!;
}

export function GlyphAvatar({
  seed,
  preset,
  size = 64,
  className,
}: {
  seed: string;
  preset: AvatarPreset;
  size?: number;
  className?: string;
}) {
  const h = hash(seed);
  const index = AVATAR_PRESETS.indexOf(preset);

  // A 5x5 grid mirrored down the vertical axis, so the mark reads as a
  // deliberate emblem instead of visual noise.
  const cells: boolean[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      cells.push(((h >>> ((y * 3 + x) % 27)) & 1) === 1);
    }
  }
  const filled = (x: number, y: number) => {
    const col = x < 3 ? x : 4 - x;
    return cells[y * 3 + col] ?? false;
  };

  const unit = 100 / 5;

  const shape = index % 4;
  const inverted = index >= 4;

  const ground = inverted ? "var(--cf-ink)" : "var(--cf-cream)";
  const mark = inverted ? "var(--cf-cream)" : "var(--cf-ink)";

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Avatar"
      shapeRendering="crispEdges"
    >
      <rect width="100" height="100" fill={ground} />
      {Array.from({ length: 5 }).flatMap((_, y) =>
        Array.from({ length: 5 }).map((_, x) => {
          if (!filled(x, y)) return null;
          const cx = x * unit;
          const cy = y * unit;
          const key = `${x}-${y}`;

          if (shape === 1) {
            return (
              <circle key={key} cx={cx + unit / 2} cy={cy + unit / 2} r={unit / 2.4} fill={mark} />
            );
          }
          if (shape === 2) {
            // Diagonal half-cell — gives the mark a woven, drawn feel.
            return (
              <polygon
                key={key}
                points={`${cx},${cy + unit} ${cx + unit},${cy} ${cx + unit},${cy + unit}`}
                fill={mark}
              />
            );
          }
          if (shape === 3) {
            return (
              <rect
                key={key}
                x={cx + unit * 0.18}
                y={cy + unit * 0.18}
                width={unit * 0.64}
                height={unit * 0.64}
                fill={mark}
              />
            );
          }
          return <rect key={key} x={cx} y={cy} width={unit} height={unit} fill={mark} />;
        }),
      )}
      {/* The drawn edge every surface in this app has. */}
      <rect
        x="0.75"
        y="0.75"
        width="98.5"
        height="98.5"
        fill="none"
        stroke="var(--cf-line-strong)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
