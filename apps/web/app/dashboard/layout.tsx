"use client";

import React, { useState } from "react";
import { EB_Garamond, Caveat } from "next/font/google";
import Image from "next/image";
import { ArrowUpRight, Building2, Flame, Menu, Sparkles, X, Zap } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

import Sidebar from "~/components/Sidebar";
import { DashboardProvider } from "~/providers/dashboard-provider";
import { useCreateForm } from "~/hooks/api/form";
import { useGetMe, type UserPlan } from "~/hooks/api/user";

// kept loaded so child pages that still reference `--font-garamond` /
// `--font-caveat` (sketches, form preview, etc.) keep working
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
});
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

// Visual treatment per tier — picked from cf-orange tints so the pill grows
// in emphasis as the plan does.
const PLAN_STYLE: Record<
  UserPlan,
  { icon: React.ComponentType<{ className?: string }>; chipClass: string }
> = {
  Free: {
    icon: Sparkles,
    chipClass:
      "bg-[color:var(--cf-cream-2)] ring-[color:var(--cf-line-strong)] text-[color:var(--cf-ink)]",
  },
  Pro: {
    icon: Zap,
    chipClass:
      "bg-[color:var(--cf-orange)]/8 ring-[color:var(--cf-orange)]/25 text-[color:var(--cf-ink)]",
  },
  "Pro+": {
    icon: Flame,
    chipClass:
      "bg-[color:var(--cf-orange)]/15 ring-[color:var(--cf-orange)]/40 text-[color:var(--cf-orange)]",
  },
  Business: {
    icon: Building2,
    chipClass: "bg-[color:var(--cf-ink)] ring-[color:var(--cf-ink)] text-white",
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Plan comes from the server; the pricing page's local "switch" only
  // affects analytics gating, but the top-of-dashboard pill reflects truth.
  const { plan, isLoading: isLoadingPlan } = useGetMe();
  const planStyle = PLAN_STYLE[plan];
  const PlanIcon = planStyle.icon;

  const isBuilderPage =
    pathname.includes("/dashboard/sketches/") && pathname !== "/dashboard/sketches";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [isCreatingForm, setIsCreatingForm] = useState(false);

  const { createFormAsync } = useCreateForm();

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    );
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug) {
      toast.error("Please enter a title and slug.");
      return;
    }

    const savedTitle = title;
    const savedSlug = slug;
    const savedDesc = description;

    setCreateModalOpen(false);
    setTitle("");
    setDescription("");
    setSlug("");
    setIsCreatingForm(true);

    createFormAsync({
      title: savedTitle,
      description: savedDesc || undefined,
      slug: savedSlug,
    })
      .then((data) => {
        router.push(`/dashboard/sketches/${data.id}`);
      })
      .catch((err) => {
        toast.error(err.message || "Failed to create form.");
        setTitle(savedTitle);
        setDescription(savedDesc);
        setSlug(savedSlug);
        setCreateModalOpen(true);
        setIsCreatingForm(false);
      });
  };

  const wrapperClass = `${ebGaramond.variable} ${caveat.variable} cf-landing min-h-screen bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)]`;

  if (isBuilderPage) {
    return (
      <DashboardProvider
        value={{
          openCreateFormModal: () => setCreateModalOpen(true),
          isCreatingForm,
          setIsCreatingForm,
        }}
      >
        {isCreatingForm && <CreatingOverlay />}
        <div className={wrapperClass}>{children}</div>
      </DashboardProvider>
    );
  }

  return (
    <DashboardProvider
      value={{
        openCreateFormModal: () => setCreateModalOpen(true),
        isCreatingForm,
        setIsCreatingForm,
      }}
    >
      <div className={`${wrapperClass} flex flex-col md:flex-row`}>
        {isCreatingForm && <CreatingOverlay />}

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-[color:var(--cf-line)] bg-[color:var(--cf-cream)] z-40">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="" width={28} height={28} className="object-contain" />
            <span className="cf-display text-[20px] leading-none">CanvasFlow</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-[color:var(--cf-cream-2)] cursor-pointer"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main */}
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto max-w-7xl mx-auto w-full">
            {/* Top context bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[color:var(--cf-line)] pb-4 gap-3">
              <div className="flex items-center gap-3">
                <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">
                  Overview · CanvasFlow Studio
                </p>
              </div>

              {isLoadingPlan ? (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 ring-[color:var(--cf-line)] bg-[color:var(--cf-cream-2)] self-start sm:self-auto"
                  aria-label="Loading plan"
                >
                  <span className="size-3 rounded-full bg-[color:var(--cf-line-strong)] animate-pulse" />
                  <span className="h-2.5 w-14 rounded-full bg-[color:var(--cf-line-strong)] animate-pulse" />
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 text-[11px] font-mono self-start sm:self-auto transition-colors ${planStyle.chipClass}`}
                >
                  <PlanIcon
                    className={`size-3 ${
                      plan === "Business" ? "text-white" : "text-[color:var(--cf-orange)]"
                    }`}
                  />
                  <span>{plan} plan</span>
                </span>
              )}
            </div>

            <div className="w-full">{children}</div>
          </main>
        </div>

        {/* Create form modal */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--cf-ink)]/45 backdrop-blur-sm p-4">
            <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] p-7 sm:p-8 max-w-md w-full relative shadow-[0_40px_80px_-30px_rgba(22,19,17,0.35)]">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="absolute top-3.5 right-3.5 p-1.5 text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)] rounded-md hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>

              <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">New canvas</p>
              <h3 className="mt-3 cf-display text-[26px] sm:text-[30px] leading-tight">
                Start a new form
              </h3>
              <p className="mt-2 text-[13.5px] text-[color:var(--cf-ink-soft)] leading-relaxed">
                Give your form a title and a unique slug. You can rename it later — your data keys
                stay stable.
              </p>

              <form onSubmit={handleFormSubmit} className="mt-6 space-y-4">
                <FieldGroup label="Title">
                  <input
                    type="text"
                    required
                    placeholder="Quarterly feedback"
                    value={title}
                    onChange={handleTitleChange}
                    className="w-full bg-[color:var(--cf-cream)] rounded-md ring-1 ring-[color:var(--cf-line-strong)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none px-4 h-[42px] text-[14px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow"
                  />
                </FieldGroup>

                <FieldGroup label="Slug">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-mono text-[color:var(--cf-ink-soft)]">
                      /
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="quarterly-feedback"
                      value={slug}
                      onChange={handleSlugChange}
                      className="w-full bg-[color:var(--cf-cream)] rounded-md ring-1 ring-[color:var(--cf-line-strong)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none pl-7 pr-4 h-[42px] text-[14px] font-mono text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow"
                    />
                  </div>
                </FieldGroup>

                <FieldGroup label="Description" optional>
                  <textarea
                    placeholder="A short note for your team..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-[color:var(--cf-cream)] rounded-md ring-1 ring-[color:var(--cf-line-strong)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none px-4 py-3 text-[14px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow resize-none"
                  />
                </FieldGroup>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 text-[13px] font-medium rounded-full text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingForm}
                    className="group inline-flex items-center gap-1.5 px-5 py-2 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-full text-[13px] font-medium transition-colors cursor-pointer"
                  >
                    {isCreatingForm ? "Creating..." : "Create form"}
                    <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardProvider>
  );
}

function FieldGroup({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="cf-eyebrow text-[color:var(--cf-ink-soft)] mb-2 flex items-center gap-2">
        {label}
        {optional && (
          <span className="text-[9px] normal-case tracking-normal opacity-70 font-mono">
            optional
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function CreatingOverlay() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[color:var(--cf-cream)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Drafting your form...</p>
      </div>
    </div>
  );
}
