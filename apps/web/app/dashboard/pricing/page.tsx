"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight, Building2, Check, Flame, Sparkles, User, Zap } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  name: string;
  price: string;
  period: string;
  submissions: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    submissions: "1,000 submissions / mo",
    description: "For students, side projects, and small launches.",
    icon: User,
    features: [
      "10 active forms",
      "All field types",
      "Basic analytics · 30-day history",
      "CSV export",
      "&quot;Made with CanvasFlow&quot; footer on forms",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "₹299",
    period: "month",
    submissions: "10,000 submissions / mo",
    description: "For solo creators and small studios.",
    icon: Zap,
    features: [
      "50 active forms",
      "Remove &quot;Made with CanvasFlow&quot; footer",
      "Webhooks & email notifications",
      "1-year submission history",
      "Email support",
    ],
  },
  {
    name: "Pro+",
    price: "₹899",
    period: "month",
    submissions: "50,000 submissions / mo",
    description: "For active teams and high-traffic launches.",
    icon: Flame,
    popular: true,
    features: [
      "200 active forms",
      "Detailed analytics · per-question breakdowns",
      "3-year submission history",
      "File uploads & e-signatures",
      "Conditional logic & branching",
      "Slack & Zapier integrations",
      "Priority support · 24-hour response",
    ],
  },
  {
    name: "Business",
    price: "₹2,499",
    period: "month",
    submissions: "500,000 submissions / mo",
    description: "Compliance, scale, and team workflows.",
    icon: Building2,
    features: [
      "Unlimited forms",
      "5 team seats (add more)",
      "SSO & role-based access",
      "Custom domain & branding",
      "Audit log & data retention controls",
      "Unlimited submission history",
      "Dedicated CSM · 99.95% SLA",
    ],
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Can I switch plans later?",
    a: "Yes — upgrade or downgrade any time. Changes apply at the next billing cycle and unused credit is prorated.",
  },
  {
    q: "What counts as a submission?",
    a: "A submission is one completed response from a respondent. Views, drafts, and partial completions don't count.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free tier is free forever — no card required.",
  },
];

export default function PricingPage() {
  const [activePlan, setActivePlan] = useState<string>("Free");

  useEffect(() => {
    const saved = localStorage.getItem("cf-active-plan");
    if (saved === "Free") {
      setActivePlan(saved);
    } else {
      localStorage.setItem("cf-active-plan", "Free");
      setActivePlan("Free");
      window.dispatchEvent(new Event("activePlanChanged"));
    }
  }, []);

  const handleSelectPlan = (planName: string) => {
    setActivePlan(planName);
    localStorage.setItem("cf-active-plan", planName);
    window.dispatchEvent(new Event("activePlanChanged"));
    toast.success(`Switched to the ${planName} plan`);
  };

  return (
    <div className="space-y-12">
      {/* ───── hero ───── */}
      <div className="text-center space-y-5 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-(--cf-cream-2) ring-1 ring-(--cf-line-strong)">
          <Sparkles className="size-3 text-(--cf-orange)" />
          <span className="cf-eyebrow text-(--cf-ink-soft)">Plans</span>
        </div>
        <h1 className="cf-display text-[40px] sm:text-[52px] leading-[0.95]">
          Simple, transparent pricing
        </h1>
        <p className="text-[14.5px] text-(--cf-ink-soft) leading-relaxed">
          Start free. Upgrade when you outgrow it. Every plan includes durable data keys, real-time
          analytics, and unlimited respondents — only your monthly submissions and form count scale.
        </p>
      </div>

      {/* ───── plan grid ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = activePlan === plan.name;
          const isFree = plan.name === "Free";

          return (
            <div
              key={plan.name}
              className={`relative flex flex-col bg-(--cf-cream-2) rounded-2xl p-6 transition-all ${
                plan.popular
                  ? "ring-2 ring-(--cf-orange) shadow-[0_30px_60px_-30px_rgba(246,111,0,0.45)]"
                  : "ring-1 ring-(--cf-line) hover:ring-(--cf-line-strong)"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-(--cf-orange) text-white text-[10px] font-mono uppercase tracking-wider">
                  Most popular
                </div>
              )}

              <div className="space-y-5 flex-1">
                {/* header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-md bg-(--cf-cream) ring-1 ring-(--cf-line) flex items-center justify-center">
                      <Icon className="size-4 text-(--cf-orange)" />
                    </div>
                    <span className="cf-display text-[18px] leading-none text-(--cf-ink)">
                      {plan.name}
                    </span>
                  </div>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-(--cf-orange)/15 text-(--cf-orange) ring-1 ring-(--cf-orange)/30 text-[10px] font-mono uppercase tracking-wider">
                      <span className="size-1 rounded-full bg-(--cf-orange)" />
                      Active
                    </span>
                  )}
                </div>

                {/* price */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="cf-display text-[36px] leading-none tabular-nums text-(--cf-ink)">
                      {plan.price}
                    </span>
                    <span className="text-[12px] font-mono text-(--cf-ink-soft)">
                      / {plan.period}
                    </span>
                  </div>
                  <p className="text-[12px] font-mono text-(--cf-ink-soft)">
                    {plan.submissions}
                  </p>
                </div>

                {/* description */}
                <p className="text-[13.5px] text-(--cf-ink-soft) leading-relaxed min-h-[42px]">
                  {plan.description}
                </p>

                {/* divider */}
                <div className="h-px bg-(--cf-line)" />

                {/* features */}
                <ul className="space-y-2.5">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[13px] text-(--cf-ink)"
                    >
                      <span className="size-4 rounded-full bg-(--cf-orange)/12 ring-1 ring-(--cf-orange)/25 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="size-2.5 text-(--cf-orange)" />
                      </span>
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="pt-6">
                <button
                  disabled={!isFree || isCurrent}
                  onClick={() => isFree && handleSelectPlan(plan.name)}
                  className={`group w-full inline-flex items-center justify-center gap-1.5 h-[42px] rounded-full text-[13px] font-medium tracking-tight transition-colors cursor-pointer disabled:cursor-not-allowed ${
                    isCurrent
                      ? "bg-(--cf-ink) text-white"
                      : isFree
                        ? plan.popular
                          ? "bg-(--cf-orange) hover:bg-(--cf-orange-hover) text-white"
                          : "ring-1 ring-(--cf-line-strong) bg-(--cf-cream) hover:bg-(--cf-cream-2) text-(--cf-ink)"
                        : "ring-1 ring-(--cf-line) bg-transparent text-(--cf-ink-soft)"
                  }`}
                >
                  {isCurrent ? "Current plan" : isFree ? "Select plan" : "Coming soon"}
                  {isFree && !isCurrent && (
                    <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ───── compare strip ───── */}
      <div className="bg-(--cf-cream-2) rounded-xl ring-1 ring-(--cf-line) p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <p className="cf-eyebrow text-(--cf-ink-soft)">Built into every plan</p>
          <h3 className="cf-display text-[20px] leading-tight">
            The same canvas, the same data layer
          </h3>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-mono text-(--cf-ink-soft)">
          {[
            "Drag-and-drop builder",
            "All field types",
            "Real-time submissions",
            "Durable data keys",
            "CSV export",
          ].map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check className="size-3 text-(--cf-orange)" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* ───── FAQ ───── */}
      <div className="space-y-5">
        <div className="text-center space-y-2 max-w-md mx-auto">
          <p className="cf-eyebrow text-(--cf-ink-soft)">FAQ</p>
          <h2 className="cf-display text-[28px] leading-tight">Common questions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="bg-(--cf-cream-2) rounded-xl ring-1 ring-(--cf-line) p-5 space-y-2"
            >
              <h3 className="cf-display text-[16px] leading-tight text-(--cf-ink)">
                {item.q}
              </h3>
              <p className="text-[13px] text-(--cf-ink-soft) leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
