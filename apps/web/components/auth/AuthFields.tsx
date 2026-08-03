"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

export const FieldLabel = ({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) => (
  <label
    htmlFor={htmlFor}
    className="hex-mono mb-1.5 block text-[10px] font-bold tracking-[0.18em] uppercase"
    style={{ color: "var(--hex-ink-muted)" }}
  >
    {children}
  </label>
);

const INPUT_CLASS =
  "w-full rounded-none border hex-line-strong bg-white px-4 py-3 text-[15px] outline-none transition-shadow placeholder:text-(--hex-ink-muted) focus:shadow-[3px_3px_0_0_rgba(26,29,41,0.14)]";

export const Field = ({
  id,
  label,
  type,
  placeholder,
  register,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  register: UseFormRegisterReturn;
  error?: string;
  autoComplete?: string;
}) => (
  <div>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      {...register}
      className={INPUT_CLASS}
    />
    {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
  </div>
);

export const PasswordField = ({
  id,
  label,
  placeholder,
  register,
  error,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  placeholder?: string;
  register: UseFormRegisterReturn;
  error?: string;
  autoComplete?: string;
  hint?: string;
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...register}
          className={`${INPUT_CLASS} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // The input already announces itself; this control needs its own
          // name, and its state has to be spoken rather than shown by icon.
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute top-1/2 right-3 -translate-y-1/2 p-1 transition-colors"
          style={{ color: "var(--hex-ink-muted)" }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        hint && (
          <p
            className="hex-mono mt-2 text-[10px] tracking-[0.14em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            {hint}
          </p>
        )
      )}
    </div>
  );
};

const FieldError = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <p id={id} role="alert" className="mt-1.5 text-[12px]" style={{ color: "var(--c-red)" }}>
    {children}
  </p>
);

/** Google + GitHub row. */
export const SocialButtons = ({
  onSelect,
  disabled,
}: {
  onSelect: (provider: "google" | "github") => void;
  disabled?: boolean;
}) => (
  <div className="flex flex-col gap-3 sm:flex-row">
    {(["google", "github"] as const).map((provider) => (
      <button
        key={provider}
        type="button"
        onClick={() => onSelect(provider)}
        disabled={disabled}
        className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-none border hex-line-strong bg-transparent px-4 py-3 text-[13.5px] font-medium transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
      >
        {provider === "google" ? <GoogleGlyph /> : <GitHubGlyph />}
        {provider === "google" ? "Google" : "GitHub"}
      </button>
    ))}
  </div>
);

const GoogleGlyph = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const GitHubGlyph = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);
