"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import {
  AlignLeft,
  Binary,
  Calendar,
  CheckSquare,
  Clock,
  Layers,
  Link2,
  List,
  Mail,
  Paperclip,
  Phone,
  Star,
  ToggleLeft,
  Trash2,
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
  { type: "FILE_UPLOAD", label: "File upload", icon: Paperclip, description: "Attach a document" },
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
      className={`w-72 cursor-pointer border-2 bg-white transition-shadow select-none ${
        selected
          ? "border-(--cf-orange) shadow-[5px_5px_0_0_var(--cf-orange)]"
          : "border-(--cf-line-strong) shadow-[4px_4px_0_0_rgba(26,29,41,0.16)] hover:shadow-[4px_4px_0_0_rgba(26,29,41,0.32)]"
      }`}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-2"
        style={{ borderBottomColor: "var(--cf-line)", background: "var(--cf-cream)" }}
      >
        <div className="cf-meta inline-flex items-center gap-1.5">
          <IconComponent className="size-3 text-(--cf-orange)" />
          <span>{field.type.replace("_", " ")}</span>
        </div>
        {field.isRequired && (
          <span
            className="inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase"
            style={{ borderColor: "var(--cf-orange)", color: "var(--cf-orange)" }}
          >
            Req
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {/* label + description */}
        <div className="space-y-1.5">
          <h4 className="cf-display text-[16px] leading-snug text-(--cf-ink) line-clamp-2">
            {field.label || `Untitled ${field.type.replace("_", " ").toLowerCase()}`}
          </h4>

          {field.description && (
            <p className="text-[11px] text-(--cf-ink-soft) leading-relaxed">{field.description}</p>
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
          border: "2px solid var(--cf-ink)",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          background: "var(--cf-orange)",
          border: "2px solid var(--cf-ink)",
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
      <div className="space-y-1 border border-(--cf-line-strong) bg-(--cf-cream) p-2.5">
        {options.slice(0, 3).map((opt, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-[11px] text-(--cf-ink-soft)"
          >
            <span className="truncate pr-2">{opt}</span>
            <span className="text-[9px] text-(--cf-ink-soft)/50">▼</span>
          </div>
        ))}
        {options.length > 3 && (
          <p className="text-[10px] font-mono text-(--cf-ink-soft)/50 text-center pt-0.5">
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
          <div key={i} className="flex items-center gap-2 text-[11px] text-(--cf-ink-soft)">
            <div className="size-3 shrink-0 border border-(--cf-line-strong) bg-(--cf-cream)" />
            <span className="truncate">{opt}</span>
          </div>
        ))}
        {options.length > 3 && (
          <p className="text-[10px] font-mono text-(--cf-ink-soft)/50 pl-5">
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
          <Star key={i} className="size-3.5 text-(--cf-ink)/15 fill-current" />
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
      <div className="flex items-center justify-between border border-(--cf-line-strong) bg-(--cf-cream) px-3 py-2 text-[12px] text-(--cf-ink-soft)">
        <span className="truncate pr-2">{range}</span>
        <Calendar className="size-3.5 text-(--cf-ink-soft)/55 shrink-0" />
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
      <div className="flex items-center justify-between border border-(--cf-line-strong) bg-(--cf-cream) px-3 py-2 text-[12px] text-(--cf-ink-soft)">
        <span className="truncate pr-2">{range}</span>
        <Clock className="size-3.5 text-(--cf-ink-soft)/55 shrink-0" />
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
            !on ? "font-medium text-(--cf-ink)" : "text-(--cf-ink-soft)/55"
          }`}
        >
          {o?.inactiveLabel || "No"}
        </span>
        <div
          className={`relative inline-flex h-4 w-8 shrink-0 rounded-full transition-colors ${
            on ? "bg-(--cf-orange)" : "bg-(--cf-ink)/15"
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
            on ? "font-medium text-(--cf-orange)" : "text-(--cf-ink-soft)/55"
          }`}
        >
          {o?.activeLabel || "Yes"}
        </span>
      </div>
    );
  }

  if (field.type === "FILE_UPLOAD") {
    const o = field.options as any;
    const accept: string[] = Array.isArray(o?.accept) ? o.accept : [];
    const limit = o?.maxMb ? `${o.maxMb}MB max` : "";
    const kinds = accept.length > 0 ? accept.join(", ") : "Any allowed type";

    return (
      <div className="border border-dashed border-(--cf-line-strong) bg-(--cf-cream) px-3 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-(--cf-ink-soft)">
          <Paperclip className="size-3.5 shrink-0 text-(--cf-ink-soft)/55" />
          <span className="truncate">{field.placeholder || "Choose a file"}</span>
        </div>
        <p className="mt-1 truncate font-mono text-[10px] text-(--cf-ink-soft)/60">
          {[kinds, limit].filter(Boolean).join(" · ")}
        </p>
      </div>
    );
  }

  // text/textarea/email/number/phone/url
  return (
    <div className="border border-(--cf-line-strong) bg-(--cf-cream) px-3 py-2 text-[12px] text-(--cf-ink-soft)">
      {field.placeholder || "Answer here..."}
    </div>
  );
}

export const SegmentHeaderNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const { segment, position, onRename, onUpdateDescription, onDelete } = data;

  return (
    <div
      className={`w-72 cursor-pointer border-2 bg-(--cf-cream) p-3 transition-shadow select-none ${
        selected
          ? "border-(--cf-orange) shadow-[5px_5px_0_0_var(--cf-orange)]"
          : "border-(--cf-orange) border-dashed shadow-[4px_4px_0_0_rgba(26,29,41,0.1)] hover:shadow-[4px_4px_0_0_rgba(26,29,41,0.2)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-dashed border-(--cf-line-strong) mb-2">
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-(--cf-orange)" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-(--cf-orange)">
            Page {position}
          </span>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-(--cf-ink-soft) hover:text-red-600 transition-colors"
            aria-label="Delete segment"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <input
          value={segment.title || ""}
          onChange={(e) => onRename(e.target.value)}
          placeholder={`Segment ${position} Title`}
          className="cf-input w-full h-8 px-2 text-[13px] font-semibold"
          onMouseDown={(e) => e.stopPropagation()}
        />
        <textarea
          value={segment.description || ""}
          onChange={(e) => onUpdateDescription(e.target.value)}
          placeholder="Segment description (optional)..."
          className="cf-input w-full min-h-12 p-2 text-[11px] leading-relaxed resize-none"
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: "var(--cf-orange)",
          border: "2px solid var(--cf-ink)",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          background: "var(--cf-orange)",
          border: "2px solid var(--cf-ink)",
        }}
      />
    </div>
  );
};

export const nodeTypes = {
  formField: FormFieldNode,
  segmentHeader: SegmentHeaderNode,
};
