"use client";

import React, { useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

import DashboardNav from "~/components/DashboardNav";
import Noise from "~/components/Noise";
import Footer from "~/components/Footer";
import { VerticalScale } from "~/components/Scale";
import { DashboardProvider } from "~/providers/dashboard-provider";
import { useCreateForm } from "~/hooks/api/form";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [createModalOpen, setCreateModalOpen] = useState(false);

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

  const wrapperClass =
    "cf-landing cf-dotgrid relative min-h-screen bg-(--cf-cream) text-(--cf-ink)";

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
        <div className={wrapperClass}>
          <Noise />
          {children}
        </div>
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
      <div className={wrapperClass}>
        <Noise />
        {isCreatingForm && <CreatingOverlay />}

        <DashboardNav />

        <div className="pointer-events-none absolute inset-0 hidden md:block">
          <VerticalScale className="absolute inset-y-0 left-0" />
          <VerticalScale className="absolute inset-y-0 right-0" />
        </div>

        <main className="relative z-10 mx-auto w-full max-w-350 px-4 py-10 sm:px-8 sm:py-14 lg:py-20">
          {children}
        </main>

        <div className="relative z-10">
          <Footer />
        </div>

        {/* Create form modal */}
        {createModalOpen && (
          <div className="cf-scrim">
            <div className="cf-dark cf-crop w-full max-w-lg">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="cf-dark-btn-outline absolute top-4 right-4 z-10 size-8"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>

              <div className="relative z-1 p-6 sm:p-8">
                <p className="cf-dark-meta">New canvas</p>
                <h3 className="cf-display mt-3 text-[30px] leading-none uppercase sm:text-[38px]">
                  New form
                  <span style={{ color: "var(--cf-orange)" }}>.</span>
                </h3>
                <p
                  className="mt-3 text-[13.5px] leading-relaxed"
                  style={{ color: "var(--cfd-text-soft)" }}
                >
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
                      className="cf-dark-input h-10.5 px-4 text-[14px]"
                    />
                  </FieldGroup>

                  <FieldGroup label="Slug">
                    <div className="relative">
                      <span
                        className="absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[13px]"
                        style={{ color: "var(--cfd-text-muted)" }}
                      >
                        /
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="quarterly-feedback"
                        value={slug}
                        onChange={handleSlugChange}
                        className="cf-dark-input h-10.5 pr-4 pl-7 font-mono text-[14px]"
                      />
                    </div>
                  </FieldGroup>

                  <FieldGroup label="Description" optional>
                    <textarea
                      placeholder="A short note for your team..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="cf-dark-input resize-none px-4 py-3 text-[14px]"
                    />
                  </FieldGroup>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCreateModalOpen(false)}
                      className="cf-dark-btn-outline px-4 py-2 text-[13px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingForm}
                      className="cf-btn group px-5 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingForm ? "Creating..." : "Create form"}
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  </div>
                </form>
              </div>
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
      <label className="cf-dark-meta mb-2 flex items-center gap-2">
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
    <div className="fixed inset-0 z-200 flex flex-col items-center justify-center bg-(--cf-cream)">
      <div className="flex flex-col items-center gap-4">
        <div className="size-8 animate-spin rounded-full border-2 border-(--cf-line) border-t-(--cf-orange)" />
        <p className="cf-meta">Drafting your form</p>
      </div>
    </div>
  );
}
