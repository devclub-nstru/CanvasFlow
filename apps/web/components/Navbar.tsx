"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useGetLoggedInUserInfo } from "~/hooks/api/auth";

/* ── Nav content ───────────────────────────────────────────────────────
   Held as data rather than inline JSX so the desktop dropdowns and the
   mobile panel render from one source. Inlining it twice is how the two
   drift apart. */

type NavLinkItem = { title: string; desc: string; href: string };

const PLATFORM_GROUPS: { heading: string; items: NavLinkItem[] }[] = [
  {
    heading: "Products",
    items: [
      {
        title: "Field library",
        desc: "Twelve field types, drag to reorder, edit inline",
        href: "/#fields",
      },
      {
        title: "Visual form canvas",
        desc: "Build, set required fields, and publish on one surface",
        href: "/#canvas",
      },
      {
        title: "Response analytics",
        desc: "Live dashboards the moment answers start landing",
        href: "/#analytics",
      },
      {
        title: "Response stream",
        desc: "Every submission in a table you can export",
        href: "/#responses",
      },
    ],
  },
  {
    heading: "Capabilities",
    items: [
      {
        title: "One question at a time",
        desc: "A focused flow with a progress bar and inline validation",
        href: "/#how-it-works",
      },
      {
        title: "Share by link or QR",
        desc: "Publish, copy the link, or hand over a QR code",
        href: "/#responses",
      },
      {
        title: "CSV export",
        desc: "Take every response with you whenever you want",
        href: "/#analytics",
      },
      {
        title: "Access controls",
        desc: "Close a form, set an expiry, or cap submissions",
        href: "/#faq",
      },
    ],
  },
];

const PLATFORM_PROMO = {
  title: "Build together",
  desc: "Invite teammates with per-area roles and hand over ownership",
  href: "/#collaborate",
};

const SOLUTIONS_ITEMS: NavLinkItem[] = [
  { title: "For product teams", desc: "User research and feedback loops", href: "/#how-it-works" },
  { title: "For marketing", desc: "Lead capture and qualification", href: "/#how-it-works" },
  {
    title: "For customer success",
    desc: "Satisfaction ratings and follow-ups",
    href: "/#analytics",
  },
];

const RESOURCES_ITEMS: NavLinkItem[] = [
  { title: "Documentation", desc: "A guide to every feature", href: "/docs" },
  { title: "Learn more", desc: "Every capability, end to end", href: "/learn-more" },
  { title: "About", desc: "Why CanvasFlow exists", href: "/about" },
  { title: "Your forms", desc: "Jump back into a draft", href: "/dashboard/sketches" },
  { title: "FAQ", desc: "The short answers, fast", href: "/#faq" },
];

interface NavItemProps {
  label: string;
  to?: string;
  children?: React.ReactNode;
  dropdownAlign?: "left" | "center" | "right";
}

const NavItem = ({ label, to, children, dropdownAlign = "left" }: NavItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const alignClass =
    dropdownAlign === "left"
      ? "left-0"
      : dropdownAlign === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div
      className="relative h-full flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {to ? (
        <Link
          href={to}
          className="flex items-center gap-1.5 text-[14px] font-medium transition-colors hover:text-foreground"
          style={{ color: isOpen ? "var(--foreground)" : "var(--hex-ink-soft)" }}
        >
          {label}
        </Link>
      ) : (
        <button
          className="flex items-center gap-1.5 text-[14px] font-medium transition-colors hover:text-foreground"
          style={{ color: isOpen ? "var(--foreground)" : "var(--hex-ink-soft)" }}
        >
          {label}
          {children && (
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-300 opacity-60",
                isOpen && "rotate-180",
              )}
            />
          )}
        </button>
      )}

      {children && (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={cn("absolute top-[calc(100%-12px)] pt-4 cursor-default", alignClass)}
            >
              <div className="bg-[#fdfcfb] border hex-line-soft rounded-xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)] overflow-hidden">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

const MegaMenuItem = ({ title, desc, href }: { title: string; desc: string; href: string }) => (
  <Link href={href} className="group cursor-pointer block">
    <div className="text-[14px] font-medium text-foreground mb-1 group-hover:text-foreground transition-colors">
      {title}
    </div>
    <div className="text-[13px] leading-[1.4]" style={{ color: "var(--hex-ink-soft)" }}>
      {desc}
    </div>
  </Link>
);

const SimpleDropdown = ({ items }: { items: NavLinkItem[] }) => (
  <div className="flex w-[min(17.5rem,calc(100vw-3rem))] flex-col p-3">
    {items.map((item) => (
      <Link
        key={item.title}
        href={item.href}
        className="group cursor-pointer p-3 rounded-lg hover:bg-[#f5f3ee] transition-colors"
      >
        <div className="text-[14px] font-medium text-foreground mb-0.5 transition-colors">
          {item.title}
        </div>
        <div className="text-[13px] leading-snug" style={{ color: "var(--hex-ink-soft)" }}>
          {item.desc}
        </div>
      </Link>
    ))}
  </div>
);

const PROMO_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

const PlatformMegaMenu = () => (
  /* Capped against the viewport as well as at a fixed width. At exactly
     1024px — where this menu first appears — a hard 700px panel anchored
     under "Platform" runs past the right edge once the page gutter is
     accounted for. */
  <div className="flex w-[min(43.75rem,calc(100vw-3rem))] flex-col gap-8 p-8">
    <div className="grid grid-cols-2 gap-x-16 gap-y-8">
      {PLATFORM_GROUPS.map((group) => (
        <div key={group.heading}>
          <div
            className="hex-mono mb-5 text-[11px] font-semibold tracking-[0.15em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            {group.heading}
          </div>
          <div className="flex flex-col gap-6">
            {group.items.map((item) => (
              <MegaMenuItem key={item.title} href={item.href} title={item.title} desc={item.desc} />
            ))}
          </div>
        </div>
      ))}
    </div>

    <Link
      href={PLATFORM_PROMO.href}
      className="group relative mt-2 block cursor-pointer overflow-hidden rounded-xl border hex-line-soft bg-[#f5f3ee]/60 p-5 transition-colors hover:bg-[#f5f3ee]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-multiply"
        style={{ backgroundImage: PROMO_NOISE }}
      />
      <div className="relative z-10 flex items-center gap-3">
        <div>
          <div className="mb-0.5 text-[14px] font-semibold text-foreground">
            {PLATFORM_PROMO.title}
          </div>
          <div className="text-[13px]" style={{ color: "var(--hex-ink-soft)" }}>
            {PLATFORM_PROMO.desc}
          </div>
        </div>
      </div>
    </Link>
  </div>
);

/* ── Mobile panel ──────────────────────────────────────────────────────
   The desktop dropdowns open on hover, which has no equivalent on touch,
   so small screens get a disclosure list instead of the same menus
   crammed into a narrower box. */

const MobileSection = ({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavLinkItem[];
  onNavigate: () => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b hex-line-soft" style={{ borderBottomWidth: 1 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-left text-[15px] font-medium text-foreground"
      >
        {label}
        <ChevronDown
          className={cn(
            "h-4 w-4 opacity-60 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pb-3">
          {items.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              onClick={onNavigate}
              className="rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f5f3ee]"
            >
              <div className="text-[14px] font-medium text-foreground">{item.title}</div>
              <div className="text-[13px] leading-snug" style={{ color: "var(--hex-ink-soft)" }}>
                {item.desc}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

/** Scallop shape for the strip beneath the nav bar, used as a mask. */
const WAVE_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 10'%3E%3Cpath d='M0,0 C5,10 15,10 20,0 Z' fill='%23000'/%3E%3C/svg%3E")`;

const Navbar = () => {
  const { userInfo: user } = useGetLoggedInUserInfo();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Reaching a desktop width while the panel is open would otherwise leave
  // it mounted underneath the restored desktop nav.
  useEffect(() => {
    if (!menuOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [menuOpen]);

  return (
    <div className="sticky top-0 z-50 w-full">
      {/* Blur without a saturation boost. `backdrop-saturate` lifts the
          chroma of whatever scrolls under the bar, which works against
          the muted band the design wants. */}
      <nav
        className="relative w-full h-16 backdrop-blur-md"
        style={{
          background: "var(--hex-nav)",
          borderBottomColor: "var(--hex-line)",
        }}
      >
        <div className="max-w-300 mx-auto px-4 sm:px-6 h-full flex items-center justify-between relative z-10">
          {/* Left Navigation — desktop only. The hover dropdowns it hosts
              have no touch equivalent, so below lg the whole group is
              replaced by the disclosure panel. */}
          <div className="hidden lg:flex items-center gap-8 h-full flex-1">
            <NavItem label="Platform" dropdownAlign="left">
              <PlatformMegaMenu />
            </NavItem>

            <NavItem label="Solutions" dropdownAlign="left">
              <SimpleDropdown items={SOLUTIONS_ITEMS} />
            </NavItem>

            <Link
              href="/#faq"
              className="text-[14px] font-medium transition-colors hover:text-foreground"
              style={{ color: "var(--hex-ink-soft)" }}
            >
              Enterprise
            </Link>
          </div>

          {/* Logo. Centred on desktop between the two nav groups; flush
              left on mobile, where the hamburger takes the right. */}
          <div className="flex items-center justify-start lg:justify-center">
            <Link
              href="/"
              className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground flex items-center gap-2"
              style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
            >
              CanvasFlow
            </Link>
          </div>

          {/* Right Navigation — desktop only */}
          <div className="hidden lg:flex items-center gap-8 h-full flex-1 justify-end">
            <NavItem label="Resources" dropdownAlign="right">
              <SimpleDropdown items={RESOURCES_ITEMS} />
            </NavItem>

            <div className="flex items-center gap-4 pl-2">
              <Link
                href={user ? "/dashboard" : "/signIn"}
                className="text-[14px] font-medium transition-colors hover:text-foreground"
                style={{ color: "var(--hex-ink-soft)" }}
              >
                {user ? "Dashboard" : "Log in"}
              </Link>
              <Link href={user ? "/dashboard" : "/signUp"} className="hex-btn-ghost">
                {user ? "Go to dashboard" : "Get started"}
              </Link>
            </div>
          </div>

          {/* Hamburger — mobile only. The CTA lives inside the panel rather
              than beside this button: at 320px a 117px outlined button, the
              logo and the toggle do not fit on one line. */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-panel"
            className="lg:hidden -mr-2 flex h-10 w-10 items-center justify-center text-foreground"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile panel */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="mobile-nav-panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden absolute top-full left-0 right-0 z-20 max-h-[calc(100dvh-4rem)] overflow-y-auto border-t hex-line-soft bg-[#fdfcfb] px-4 pb-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)]"
              style={{ borderTopWidth: 1 }}
            >
              <MobileSection
                label="Platform"
                items={PLATFORM_GROUPS.flatMap((g) => g.items)}
                onNavigate={closeMenu}
              />
              <MobileSection label="Solutions" items={SOLUTIONS_ITEMS} onNavigate={closeMenu} />
              <MobileSection label="Resources" items={RESOURCES_ITEMS} onNavigate={closeMenu} />

              <Link
                href="/#faq"
                onClick={closeMenu}
                className="block border-b hex-line-soft py-4 text-[15px] font-medium text-foreground"
                style={{ borderBottomWidth: 1 }}
              >
                Enterprise
              </Link>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href={user ? "/dashboard" : "/signIn"}
                  onClick={closeMenu}
                  className="text-[15px] font-medium"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {user ? "Dashboard" : "Log in"}
                </Link>
                <Link
                  href={user ? "/dashboard" : "/signUp"}
                  onClick={closeMenu}
                  className="hex-btn-ghost w-full"
                >
                  {user ? "Go to dashboard" : "Get started"}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wave bottom decoration */}
        {/* Scalloped edge under the bar. The wave is applied as a mask and
            filled with the nav token rather than baked into the SVG, so it
            tracks `--hex-nav` instead of drifting out of step with it the
            way a hardcoded fill does. */}
        <div
          className="absolute top-[calc(100%-1px)] left-0 right-0 h-2.5 w-full pointer-events-none"
          style={{
            background: "var(--hex-nav)",
            maskImage: WAVE_MASK,
            WebkitMaskImage: WAVE_MASK,
            maskSize: "20px 10px",
            WebkitMaskSize: "20px 10px",
            maskRepeat: "repeat-x",
            WebkitMaskRepeat: "repeat-x",
          }}
          aria-hidden="true"
        />
      </nav>
    </div>
  );
};

export default Navbar;
