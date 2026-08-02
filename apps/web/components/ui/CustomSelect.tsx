import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

export interface CustomSelectOption {
  value: string | number;
  label: string;
}

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  openDirection?: "up" | "down";
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  openDirection = "down",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between border px-3 text-[13px] transition-all"
        style={{
          background: "var(--cf-cream-2)",
          borderColor: "var(--cf-line-strong)",
          height: "36px",
          textAlign: "left",
          boxShadow: "2px 2px 0 0 rgba(26, 29, 41, 0.04)",
        }}
      >
        <span className="truncate text-(--cf-ink)">{displayLabel}</span>
        <ChevronDown
          className="size-4 shrink-0 text-(--cf-ink-soft) transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute left-0 right-0 z-50 max-h-60 overflow-y-auto border py-1 shadow-lg animate-in fade-in duration-100",
            openDirection === "up"
              ? "bottom-full mb-1 slide-in-from-bottom-1"
              : "top-full mt-1 slide-in-from-top-1",
          )}
          style={{
            background: "var(--cf-cream-2)",
            borderColor: "var(--cf-line-strong)",
            boxShadow: "4px 4px 0 0 var(--cf-line-strong)",
          }}
        >
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-[13px] hover:bg-(--cf-ink-soft)/5 transition-colors"
                style={{
                  color: isSelected ? "var(--cf-orange)" : "var(--cf-ink)",
                  fontWeight: isSelected ? 600 : 400,
                  background: isSelected ? "var(--cf-cream)" : "transparent",
                }}
              >
                <span className="truncate flex-1">{option.label}</span>
                {isSelected && (
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: "var(--cf-orange)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
