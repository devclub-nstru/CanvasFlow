"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import {
  AlignLeft,
  Binary,
  Calendar,
  CheckSquare,
  Clock,
  Link2,
  List,
  Mail,
  Phone,
  Star,
  ToggleLeft,
  Type,
} from "lucide-react";

// Available field metadata for the left sidebar
export const AVAILABLE_FIELDS = [
  { type: "TEXT", label: "Short text", icon: Type, description: "Single line input" },
  { type: "TEXTAREA", label: "Long text", icon: AlignLeft, description: "Multi-line input" },
  { type: "EMAIL", label: "Email", icon: Mail, description: "Email address input" },
  { type: "NUMBER", label: "Number", icon: Binary, description: "Numeric value input" },
  { type: "PHONE", label: "Phone", icon: Phone, description: "Telephone number input" },
  { type: "URL", label: "URL", icon: Link2, description: "Website link input" },
  { type: "SELECT", label: "Single select", icon: List, description: "Dropdown menu" },
  { type: "CHECKBOX", label: "Checkbox", icon: CheckSquare, description: "Multiple checkboxes" },
  { type: "RATING", label: "Rating", icon: Star, description: "Star selection" },
  { type: "DATE", label: "Date", icon: Calendar, description: "Calendar selection" },
  { type: "TIME", label: "Time", icon: Clock, description: "Time selection" },
  { type: "TOGGLE", label: "Toggle", icon: ToggleLeft, description: "Yes / no switch" },
];

export const getFieldIcon = (type: string) => {
  const match = AVAILABLE_FIELDS.find((f) => f.type === type);
  return match ? match.icon : Type;
};

export const getFieldOptionsArray = (field: any): string[] => {
  if (Array.isArray(field.options)) return field.options;
  if (field.options && typeof field.options === "object" && Array.isArray(field.options.choices)) {
    return field.options.choices;
  }
  return ["Option 1", "Option 2"];
};

export const FormFieldNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const { field } = data;
  const IconComponent = getFieldIcon(field.type);

  return (
    <div
      className={`w-72 bg-[color:var(--cf-cream-2)] rounded-xl transition-all select-none cursor-pointer shadow-[0_8px_24px_-12px_rgba(22,19,17,0.18)] ${
        selected
          ? "ring-2 ring-[color:var(--cf-orange)] ring-offset-2 ring-offset-[color:var(--cf-cream)]"
          : "ring-1 ring-[color:var(--cf-line)] hover:ring-[color:var(--cf-line-strong)]"
      }`}
    >
      <div className="p-4 space-y-3">
        {/* header */}
        <div className="flex justify-between items-center">
          <div className="inline-flex items-center gap-1.5 cf-eyebrow text-[color:var(--cf-ink-soft)]">
            <IconComponent className="size-3 text-[color:var(--cf-orange)]" />
            <span>{field.type.replace("_", " ")}</span>
          </div>
          {field.isRequired && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[color:var(--cf-orange)]/15 text-[color:var(--cf-orange)] ring-1 ring-[color:var(--cf-orange)]/30">
              Req
            </span>
          )}
        </div>

        {/* label + description */}
        <div className="space-y-1.5">
          <h4 className="cf-display text-[16px] leading-snug text-[color:var(--cf-ink)] line-clamp-2">
            {field.label || `Untitled ${field.type.replace("_", " ").toLowerCase()}`}
          </h4>

          {field.description && (
            <p className="text-[11px] text-[color:var(--cf-ink-soft)] leading-relaxed">
              {field.description}
            </p>
          )}
        </div>

        {/* preview */}
        <div className="pt-1">
          <FieldPreview field={field} />
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: "var(--cf-orange)",
          border: "2px solid var(--cf-cream-2)",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          background: "var(--cf-orange)",
          border: "2px solid var(--cf-cream-2)",
        }}
      />
    </div>
  );
};

/* ─── per-type preview ────────────────────────────────────────────────── */

function FieldPreview({ field }: { field: any }) {
  if (field.type === "SELECT") {
    const options = getFieldOptionsArray(field);
    return (
      <div className="bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] rounded-md p-2 space-y-1">
        {options.slice(0, 3).map((opt, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-[11px] text-[color:var(--cf-ink-soft)]"
          >
            <span className="truncate pr-2">{opt}</span>
            <span className="text-[9px] text-[color:var(--cf-ink-soft)]/50">▼</span>
          </div>
        ))}
        {options.length > 3 && (
          <p className="text-[10px] font-mono text-[color:var(--cf-ink-soft)]/50 text-center pt-0.5">
            + {options.length - 3} more
          </p>
        )}
      </div>
    );
  }

  if (field.type === "CHECKBOX") {
    const options = getFieldOptionsArray(field);
    return (
      <div className="space-y-1.5">
        {options.slice(0, 3).map((opt, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[11px] text-[color:var(--cf-ink-soft)]"
          >
            <div className="size-3 rounded-sm ring-1 ring-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream)] shrink-0" />
            <span className="truncate">{opt}</span>
          </div>
        ))}
        {options.length > 3 && (
          <p className="text-[10px] font-mono text-[color:var(--cf-ink-soft)]/50 pl-5">
            + {options.length - 3} more
          </p>
        )}
      </div>
    );
  }

  if (field.type === "RATING") {
    const max = (field.options as any)?.max ?? 5;
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <Star key={i} className="size-3.5 text-[color:var(--cf-ink)]/15 fill-current" />
        ))}
      </div>
    );
  }

  if (field.type === "DATE") {
    const o = field.options as any;
    const range =
      o?.minDate || o?.maxDate
        ? `${o?.minDate ? `From ${o.minDate}` : ""}${o?.maxDate ? ` to ${o.maxDate}` : ""}`
        : field.placeholder || "Select a date";
    return (
      <div className="bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] rounded-md px-3 py-2 text-[12px] text-[color:var(--cf-ink-soft)] flex justify-between items-center">
        <span className="truncate pr-2">{range}</span>
        <Calendar className="size-3.5 text-[color:var(--cf-ink-soft)]/55 shrink-0" />
      </div>
    );
  }

  if (field.type === "TIME") {
    const o = field.options as any;
    const range =
      o?.minTime || o?.maxTime
        ? `${o?.minTime ? `From ${o.minTime}` : ""}${o?.maxTime ? ` to ${o.maxTime}` : ""}`
        : field.placeholder || "Select a time";
    return (
      <div className="bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] rounded-md px-3 py-2 text-[12px] text-[color:var(--cf-ink-soft)] flex justify-between items-center">
        <span className="truncate pr-2">{range}</span>
        <Clock className="size-3.5 text-[color:var(--cf-ink-soft)]/55 shrink-0" />
      </div>
    );
  }

  if (field.type === "TOGGLE") {
    const o = field.options as any;
    const on = !!o?.defaultValue;
    return (
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-[11px] ${
            !on ? "font-medium text-[color:var(--cf-ink)]" : "text-[color:var(--cf-ink-soft)]/55"
          }`}
        >
          {o?.inactiveLabel || "No"}
        </span>
        <div
          className={`relative inline-flex h-4 w-8 shrink-0 rounded-full transition-colors ${
            on ? "bg-[color:var(--cf-orange)]" : "bg-[color:var(--cf-ink)]/15"
          }`}
        >
          <span
            className={`pointer-events-none inline-block size-3 mt-0.5 transform rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
        <span
          className={`text-[11px] ${
            on ? "font-medium text-[color:var(--cf-orange)]" : "text-[color:var(--cf-ink-soft)]/55"
          }`}
        >
          {o?.activeLabel || "Yes"}
        </span>
      </div>
    );
  }

  // text/textarea/email/number/phone/url
  return (
    <div className="bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] rounded-md px-3 py-2 text-[12px] text-[color:var(--cf-ink-soft)]/55">
      {field.placeholder || "Answer here..."}
    </div>
  );
}

export const nodeTypes = {
  formField: FormFieldNode,
};
