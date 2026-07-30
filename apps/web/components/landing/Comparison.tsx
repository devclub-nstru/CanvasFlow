"use client";

import { useRef, useState, type MouseEvent } from 'react';
import { ScrollReveal } from './ScrollReveal';
import { cn } from '~/lib/utils';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import {
  Palette,
  BarChart3,
  Search,
  ShieldCheck,
  Smile,
  Check,
  X,
  Terminal,
  Globe,
  type LucideIcon,
} from 'lucide-react';

type CategoryId = 'ai' | 'design' | 'intel' | 'seo' | 'security' | 'vibe';

const CATEGORIES: { id: CategoryId; label: string; icon: LucideIcon }[] = [
  { id: 'ai', label: 'AI Intelligence', icon: Terminal },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'intel', label: 'Analytics', icon: BarChart3 },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'vibe', label: 'Experience', icon: Smile },
];

interface FeatureRow {
  feature: string;
  aqora: boolean | string;
  google: boolean | string;
  typeform: boolean | string;
}

const COMPARISON_DATA: Record<
  CategoryId,
  { summary: { aqora: string; others: string }; features: FeatureRow[] }
> = {
  ai: {
    summary: {
      aqora:
        'Deep neural integration with AI Forge, automated protocol generation, and real-time response prediction.',
      others: 'Legacy form builders with no AI integration. All logic and structure must be built manually.',
    },
    features: [
      { feature: 'AI Forge (Prompt-to-Form)', aqora: true, google: false, typeform: false },
      { feature: 'Neural Response Analysis', aqora: true, google: false, typeform: false },
      { feature: 'Adaptive UI Evolution', aqora: true, google: false, typeform: false },
      { feature: 'Automated Data Correlation', aqora: true, google: false, typeform: false },
      { feature: 'Predictive Smart-Logic', aqora: true, google: false, typeform: false },
    ],
  },
  design: {
    summary: {
      aqora: 'Brutalist design system with 15+ themes, custom fonts, and full visual control.',
      others: 'Limited templates with no design customization or theme switching.',
    },
    features: [
      { feature: '15+ built-in themes', aqora: true, google: false, typeform: '3 basic' },
      { feature: 'Custom font & color control', aqora: true, google: false, typeform: 'Paid' },
      { feature: 'Background patterns', aqora: true, google: false, typeform: false },
      { feature: 'Card opacity & shadow depth', aqora: true, google: false, typeform: false },
      { feature: 'Conversational layout mode', aqora: true, google: false, typeform: true },
    ],
  },
  intel: {
    summary: {
      aqora: 'Deep analytics with survey, research, and data-work intelligence modes.',
      others: 'Basic response viewing with manual CSV export required for analysis.',
    },
    features: [
      { feature: 'Real-time response dashboard', aqora: true, google: false, typeform: true },
      { feature: 'Mean, median, std deviation', aqora: true, google: false, typeform: false },
      { feature: 'Consensus detection', aqora: true, google: false, typeform: false },
      { feature: 'Score distribution charts', aqora: true, google: 'Basic', typeform: 'Paid' },
      { feature: 'Multiple analysis modes', aqora: '3 modes', google: false, typeform: false },
    ],
  },
  seo: {
    summary: {
      aqora: 'Full SEO control with meta tags, social previews, and indexing options.',
      others: 'Zero SEO capabilities. Forms are hidden from search engines entirely.',
    },
    features: [
      { feature: 'Custom meta title & description', aqora: true, google: false, typeform: 'Basic' },
      { feature: 'SEO keywords support', aqora: true, google: false, typeform: false },
      { feature: 'Indexability toggle', aqora: true, google: false, typeform: false },
      { feature: 'Social sharing previews', aqora: true, google: false, typeform: false },
      { feature: 'Custom form URLs', aqora: true, google: false, typeform: 'Paid' },
    ],
  },
  security: {
    summary: {
      aqora: 'Password protection, domain restrictions, and submission limits built-in.',
      others: 'Basic authentication tied to workspace. Advanced security is paywalled.',
    },
    features: [
      { feature: 'Password-protected forms', aqora: true, google: false, typeform: 'Paid' },
      { feature: 'Email domain restriction', aqora: true, google: 'GSuite only', typeform: 'Paid' },
      { feature: 'Submission limit control', aqora: true, google: false, typeform: 'Paid' },
      { feature: 'Form close date scheduling', aqora: true, google: true, typeform: true },
      { feature: 'Row-level security (RLS)', aqora: true, google: false, typeform: false },
    ],
  },
  vibe: {
    summary: {
      aqora: 'Edgy validation messages, quiz mode with scoring, and confetti celebrations.',
      others: 'Generic error messages. Quiz features limited or require paid plans.',
    },
    features: [
      { feature: 'Quiz mode with scoring', aqora: true, google: true, typeform: 'Paid' },
      { feature: 'Custom confirmation messages', aqora: true, google: 'Basic', typeform: true },
      { feature: 'Conditional logic branching', aqora: true, google: false, typeform: true },
      { feature: 'Section headers & descriptions', aqora: true, google: true, typeform: true },
      { feature: 'Response time tracking', aqora: true, google: false, typeform: false },
    ],
  },
};

const FeatureCell = ({ value }: { value: boolean | string }) => {
  if (value === true) return <Check className="h-5 w-5 mx-auto" style={{ color: '#22c55e' }} />;
  if (value === false) return <X className="h-5 w-5 mx-auto opacity-30" />;
  return <span className="text-[10px] font-black uppercase opacity-60">{value}</span>;
};

export const ComparisonSection = () => {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('ai');
  const containerRef = useRef<HTMLDivElement>(null);
  const data = COMPARISON_DATA[activeCategory];

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 200 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), springConfig);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section className="py-24 bg-[#080808] text-white border-y border-white/10 relative overflow-hidden selection:bg-accent selection:text-white">
      <div className="absolute inset-0 pointer-events-none z-60 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-size-[100%_2px] animate-scanlines" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.04)_1px,transparent_0)] bg-size-[40px_40px]" />

      <div className="container mx-auto px-4 relative z-10">
        <ScrollReveal direction="up">
          <div className="flex flex-col items-center text-center mb-20">
            <div className="font-mono text-[9px] tracking-[0.8em] mb-6 uppercase opacity-40">
              FEATURE COMPARISON MATRIX
            </div>

            <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter mb-6 leading-[0.9]">
              <span className="text-accent">CANVASFLOW</span>{' '}
              <span className="text-white/20">VS</span>{' '}
              <span className="text-white/60">THE REST</span>
            </h2>

            <motion.div
              animate={{ scaleX: [0, 1] }}
              transition={{ duration: 1.5, ease: 'circOut' }}
              className="h-px w-full max-w-2xl bg-linear-to-r from-transparent via-accent/50 to-transparent mb-6"
            />

            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 max-w-2xl">
              AN HONEST, FEATURE-BY-FEATURE BREAKDOWN. NO MARKETING FLUFF.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={100}>
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-3 px-6 py-3 border-2 transition-all text-left font-mono',
                    isActive
                      ? 'bg-accent text-white border-accent shadow-[0_0_30px_rgba(255,69,0,0.2)]'
                      : 'border-white/10 text-white/40 hover:text-white hover:border-white/30 bg-white/2'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  <span className="text-xs font-black uppercase tracking-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={200}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="border-2 border-accent/40 bg-accent/5 p-8 relative">
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                  CANVASFLOW APPROACH
                </span>
              </div>
              <p className="text-sm font-bold text-white/80 leading-relaxed">{data.summary.aqora}</p>
            </div>
            <div className="border-2 border-white/10 bg-white/2 p-8">
              <div className="flex items-center gap-3 mb-4">
                <Globe size={18} className="text-white/30" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                  COMPETITORS
                </span>
              </div>
              <p className="text-sm font-bold text-white/40 leading-relaxed">{data.summary.others}</p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={300}>
          <motion.div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
            className="border-2 border-white/10 bg-white/2 backdrop-blur-sm overflow-hidden"
          >
            <div className="grid grid-cols-[1fr_100px_100px_100px] md:grid-cols-[1fr_140px_140px_140px] border-b-2 border-white/10 bg-white/3">
              <div className="p-4 md:p-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">FEATURE</span>
              </div>
              <div className="p-4 md:p-6 text-center border-l border-white/5">
                <span className="text-[11px] font-black uppercase tracking-tight text-accent">CANVASFLOW</span>
              </div>
              <div className="p-4 md:p-6 text-center border-l border-white/5">
                <span className="text-[11px] font-black uppercase tracking-tight text-white/30">GOOGLE</span>
              </div>
              <div className="p-4 md:p-6 text-center border-l border-white/5">
                <span className="text-[11px] font-black uppercase tracking-tight text-white/30">TYPEFORM</span>
              </div>
            </div>

            {data.features.map((row, idx) => (
              <div
                key={idx}
                className={cn(
                  'grid grid-cols-[1fr_100px_100px_100px] md:grid-cols-[1fr_140px_140px_140px] border-b border-white/5 transition-colors hover:bg-white/3',
                  idx % 2 === 0 ? 'bg-transparent' : 'bg-white/1'
                )}
              >
                <div className="p-4 md:p-5 flex items-center gap-3">
                  <div className="w-1 h-1 bg-accent/60 shrink-0" />
                  <span className="text-xs font-bold text-white/70">{row.feature}</span>
                </div>
                <div className="p-4 md:p-5 flex items-center justify-center border-l border-white/5 bg-accent/3">
                  <FeatureCell value={row.aqora} />
                </div>
                <div className="p-4 md:p-5 flex items-center justify-center border-l border-white/5">
                  <FeatureCell value={row.google} />
                </div>
                <div className="p-4 md:p-5 flex items-center justify-center border-l border-white/5">
                  <FeatureCell value={row.typeform} />
                </div>
              </div>
            ))}
          </motion.div>
        </ScrollReveal>

        <div className="mt-20 border-t border-white/10 pt-12 flex flex-col md:flex-row justify-between items-center gap-12">
          <ScrollReveal direction="left" className="flex items-center gap-6">
            <div className="h-16 w-0.75 bg-accent" />
            <div>
              <div className="text-[10px] font-mono text-accent font-black uppercase tracking-[0.4em] mb-2">
                BUILT DIFFERENT
              </div>
              <div className="text-3xl font-black uppercase tracking-tighter leading-none text-white/80">
                EVERY FEATURE. <span className="text-accent">INCLUDED.</span>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" className="flex gap-4">
            {[
              { num: '15+', label: 'THEMES' },
              { num: '3', label: 'INTEL MODES' },
              { num: '∞', label: 'FORMS' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border border-white/10 px-6 py-4 text-center bg-white/2 hover:border-accent/40 transition-colors"
              >
                <p className="text-2xl font-black text-accent mb-1">{stat.num}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{stat.label}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};