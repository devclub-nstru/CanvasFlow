"use client";

/* Intentionally empty. The route, the role column, and the gate in
 * ../layout.tsx are the feature; what goes inside comes later. */
export default function AdminPage() {
  return (
    <div>
      <p
        className="hex-mono mb-4 text-[11px] font-bold tracking-[0.2em] uppercase"
        style={{ color: "var(--hex-ink-muted)" }}
      >
        Control
      </p>
      <h1 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[44px]">
        Admin
        <span style={{ color: "var(--c-blue)" }}>.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
        Nothing here yet.
      </p>
    </div>
  );
}
