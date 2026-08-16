# CanvasFlow Design System & Styling Guidelines

This document serves as the single source of truth for design tokens, visual aesthetics, component styling, and UI conventions in CanvasFlow (`apps/web`). All new features—including interactive presentation tools like Mentimeter—must adhere to these conventions for visual and behavioral consistency.

---

## 1. Visual Identity & Aesthetic Philosophy

CanvasFlow uses a signature **neo-editorial / refined neo-brutalist** aesthetic characterized by:
- **Off-white / Warm Cream backgrounds** (`#f0f0f0`, `#e8e8e8`) rather than stark white or generic gray.
- **Crisp Ink outlines** (`#1a1d29` with 1px borders) instead of fuzzy subtle drop shadows.
- **Hard-edge offset elevation** (`4px 4px 0 0 #1a1d29`) with tactile press interactions.
- **Electric Blue / Cobalt Accent** (`#2d5cf6` with hover `#2449d0`) for primary actions and active selections.
- **Monospace metadata accents** (`10px`/`11px` uppercase with generous letter-spacing) paired with clean geometric sans typography (`Inter`).

---

## 2. Color Palette & Theme Tokens

### Core CSS Variables (`apps/web/app/globals.css`)

```css
:root {
  /* CanvasFlow Signature Palette */
  --cf-cream: #f0f0f0;          /* Primary page background */
  --cf-cream-2: #e8e8e8;        /* Panel / card / sidebar background */
  --cf-ink: #1a1d29;            /* Primary typography & strong borders */
  --cf-ink-soft: #5b6070;       /* Secondary labels, muted text */
  --cf-line: rgba(26, 29, 41, 0.16); /* Subtle internal dividers */
  --cf-line-strong: #1a1d29;    /* Structural borders & hard shadows */
  
  /* Accents */
  --cf-orange: #2d5cf6;         /* Primary brand accent (Electric Cobalt) */
  --cf-orange-hover: #2449d0;   /* Accent hover state */
  --cf-danger: #c1281d;         /* Destructive actions & error states */

  /* Radii */
  --hex-radius: 6px;            /* Standard component border-radius */
  --radius: 0.625rem;
}
```

### OKLCH Base Tokens (Tailwind CSS v4)
Used by standard UI primitives:
- `bg-background` / `text-foreground`
- `border-border` (`oklch(0.922 0 0)`)
- `bg-primary` (`oklch(0.205 0 0)`) / `text-primary-foreground` (`oklch(0.985 0 0)`)
- `bg-muted` (`oklch(0.97 0 0)`) / `text-muted-foreground` (`oklch(0.556 0 0)`)
- `bg-destructive` (`oklch(0.577 0.245 27.325)`)

---

## 3. Typography Hierarchy

| Style Class | Font Family | Size / Weight | Letter Spacing | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`.cf-display`** | `Inter`, sans-serif | 24px–48px / SemiBold (600) | `-0.035em` | Page titles, slide headers, hero text |
| **Body text** | `Inter`, sans-serif | 14px–16px / Regular (400) | Normal | Question labels, descriptions, body copy |
| **`.cf-eyebrow`** | `Mono`, monospace | 11px / Medium (500) | `0.35em`, UPPERCASE | Section badges, category indicators |
| **`.cf-meta`** | `Mono`, monospace | 10px / Bold (700) | `0.18em`, UPPERCASE | Timestamps, counters, status pills, shortcuts |

---

## 4. Reusable Component Utility Classes

### 1. Panels & Cards
- **`.cf-panel`**: Container with cream background, 1px ink border, and standardized radius.
  ```html
  <div class="cf-panel p-6">...</div>
  ```
- **`.cf-raised`**: Applies the signature offset drop-shadow (`box-shadow: 4px 4px 0 0 var(--cf-line-strong)`).
- **`.cf-press`**: Interactive click effect that shifts `translate(4px, 4px)` and removes shadow on click/hover.

### 2. Buttons & Actions
- **`.cf-btn`**: Primary button with accent blue background, white text, 1px border.
  ```html
  <button class="cf-btn cf-raised cf-press px-4 py-2 text-sm">
    Create Presentation
  </button>
  ```
- **`.cf-btn-outline`**: Secondary button with transparent background, inverting on hover.
  ```html
  <button class="cf-btn-outline px-4 py-2 text-sm">
    Cancel
  </button>
  ```
- **`.cf-btn-danger`**: Destructive action button (red border/text, fills on hover).
- **`.cf-danger-ghost`**: Subtle icon button that reveals red accent only when hovered.
- **`.cf-add-dashed`**: Dashed border row for "Add new item / slide" actions.

### 3. Navigation & Headers
- **`.cf-tab`**: Clean tab navigation with an ink underline indicator when `aria-selected="true"`.
- **`.cf-pane-bar`**: 40px height toolbar header with border bottom used for inspector bars and tool panels.
- **`.cf-menu-item`**: Popover item row with hover transition.

---

## 5. Micro-Animations & Interactivity

1. **Motion library (`motion`)**:
   - Use `motion.div` with spring transitions for slide switches, modal overlays, voting bar growths, and toast pops.
2. **GSAP**:
   - Available for complex sequence animations (e.g. word cloud clustering, countdown timers, presentation reveals).
3. **Hover & Active States**:
   - Every clickable element MUST have an explicit hover state (color change, border highlight, or `.cf-press` translation).
   - Never use default browser focus rings; use Tailwind's `outline-ring/50` or custom ink outlines.

---

## 6. Icons & Assets

- **Library**: `lucide-react` (icons rendered with `className="w-4 h-4"` or `w-5 h-5"`, `strokeWidth={1.75}`).
- **Custom Brand Icons**: Use components from [components/ui](file:///Users/sakshamsaini/Desktop/kuchbhi/CanvasFlow/apps/web/components) (e.g. `ZapIcon.tsx`, `RocketIcon.tsx`, `ChartBarIcon.tsx`).
