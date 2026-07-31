"use client";

import React from "react";
import Link from "next/link";

const Footer = () => {
  const scrollToTop = (e: React.MouseEvent) => {
    const href = (e.currentTarget as HTMLAnchorElement).getAttribute("href");
    if (href === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    // Colour comes from the accent token rather than a literal, so the footer
    // and the app's primary actions can never drift apart.
    <footer className="relative flex flex-col overflow-hidden border-t border-(--cf-orange) bg-white font-sans text-(--cf-orange)">
      <div className="mx-auto w-full max-w-400 border-x border-(--cf-orange) flex flex-col relative">
        {/* Links Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 lg:p-12 border-b border-(--cf-orange)">
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              onClick={scrollToTop}
              className="text-2xl font-bold tracking-tighter block mb-4 hover:opacity-80 transition-opacity"
            >
              CANVASFLOW
            </Link>
            <p className="text-sm font-medium leading-relaxed max-w-xs opacity-80">
              The form builder for teams who want a working form in a minute and clean data by
              default.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">
              Directory
            </h4>
            <Link
              href="/docs"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Docs
            </Link>
            <Link
              href="/learn-more"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Learn More
            </Link>
            <Link
              href="/about"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              About
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/sketches"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Your Forms
            </Link>
            <Link
              href="/dashboard/analytics"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Analytics
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">
              Protocol
            </h4>
            <Link
              href="/privacy"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Terms of Service
            </Link>
            <Link
              href="/security"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Security
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Social</h4>
            <a
              href="https://twitter.com/canvasflow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Twitter
            </a>
            <a
              href="https://github.com/canvasflow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/canvasflow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:translate-x-1 transition-transform inline-block w-fit"
            >
              Discord
            </a>
          </div>
        </div>

        {/* Top Huge Text */}
        <div className="w-full border-b border-(--cf-orange) flex items-center justify-center p-4 lg:p-8 overflow-hidden">
          <h2 className="text-[11vw] lg:text-[9.5vw] leading-[0.8] font-medium tracking-tight whitespace-nowrap">
            CanvasFlow—Forms
          </h2>
        </div>

        {/* Middle Huge Abstract Shapes (Cut off text) */}
        <div className="w-full border-b border-(--cf-orange) overflow-hidden relative flex items-end justify-center h-[35vw] lg:h-[25vw] bg-white text-(--cf-orange)">
          <h2 className="text-[30vw] lg:text-[24vw] leading-[0.65] font-black tracking-tighter whitespace-nowrap -mb-[6vw] select-none">
            CANVASFLOW
          </h2>
        </div>

        {/* Bottom Footer bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 lg:p-6 gap-4">
          <span className="text-5xl font-black tracking-tighter leading-none">C</span>
          <span className="text-xs sm:text-sm font-mono uppercase tracking-widest">
            Created by CanvasFlow-Studio 20—26
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
