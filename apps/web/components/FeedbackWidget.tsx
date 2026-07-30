"use client";

import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageSquareWarning, X, Send, Bug, MessageCircle, Lightbulb, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { env } from '~/env.js';
import { useGetLoggedInUserInfo } from '~/hooks/api/auth';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';

type ComplaintType = 'bug' | 'feedback' | 'complaint' | 'feature_request';

const typeConfig: Record<ComplaintType, { label: string; description: string; icon: React.ReactNode }> = {
  feedback: {
    label: 'Feedback',
    description: 'Share product thoughts',
    icon: <MessageCircle size={15} />,
  },
  bug: {
    label: 'Bug report',
    description: 'Something is broken',
    icon: <Bug size={15} />,
  },
  feature_request: {
    label: 'Feature request',
    description: 'Request an improvement',
    icon: <Lightbulb size={15} />,
  },
  complaint: {
    label: 'Complaint',
    description: 'Escalate an issue',
    icon: <AlertTriangle size={15} />,
  },
};

const FeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<ComplaintType>('feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const { userInfo: user } = useGetLoggedInUserInfo();

  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = window.setTimeout(() => subjectRef.current?.focus(), 100);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const apiBase = (env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/trpc$/, '');

      const response = await fetch(`${apiBase}/api/complaints`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id ?? null,
          userEmail: user?.email ?? 'anonymous',
          type,
          subject: subject.trim(),
          message: message.trim(),
          status: 'open',
          priority: type === 'bug' ? 'high' : 'medium',
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      toast.success('Submitted successfully! We\'ll get back to you.');
      setSubject('');
      setMessage('');
      setType('feedback');
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = Boolean(subject.trim() && message.trim()) && !loading;

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        variant="default"
        size="icon"
        className={cn(
          "fixed bottom-5 right-5 z-50 h-12 w-12 border border-foreground/15 bg-foreground text-background shadow-brutal-sm hover:bg-foreground/90 focus-visible:ring-accent md:bottom-6 md:right-6",
          isOpen && "hidden"
        )}
        title="Report Issue / Feedback"
        aria-label="Open report and feedback form"
      >
        <MessageSquareWarning size={20} />
      </Button>

      {isOpen && (
        <div
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-h-[calc(100vh-1.5rem)] w-auto max-w-105 flex-col overflow-hidden border border-foreground/15 bg-background shadow-brutal-sm animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-200 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-97.5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-widget-title"
        >
          <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-4 py-4">
            <div>
              <h3 id="feedback-widget-title" className="text-sm font-bold uppercase tracking-[0.08em]">
                Report / Feedback
              </h3>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Send bugs, feedback, complaints, or requests.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 shrink-0"
              aria-label="Close report and feedback form"
            >
              <X size={16} />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Type
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.entries(typeConfig) as [ComplaintType, typeof typeConfig[ComplaintType]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    aria-pressed={type === key}
                    className={cn(
                      "flex min-h-14.5 items-start gap-2 border border-foreground/15 bg-background p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                      type === key && "border-foreground bg-foreground text-background hover:bg-foreground/90"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold leading-tight">{cfg.label}</span>
                      <span className={cn("mt-1 block text-[11px] leading-tight text-muted-foreground", type === key && "text-background/75")}>
                        {cfg.description}
                      </span>
                    </span>
                  </button>
                ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="feedback-subject" className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Subject
                </label>
                <Input
                  ref={subjectRef}
                  id="feedback-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief title"
                  maxLength={100}
                  disabled={loading}
                  className="border-foreground/20 font-medium focus-visible:ring-accent"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="feedback-message" className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Details
                  </label>
                  <span className="text-[11px] font-medium text-muted-foreground">{message.length}/1000</span>
                </div>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what happened or what you need"
                  rows={5}
                  maxLength={1000}
                  disabled={loading}
                  className="min-h-33 resize-none border-foreground/20 font-medium focus-visible:ring-accent"
                />
              </div>

              {user?.email && (
                <p className="border border-foreground/10 bg-secondary/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Submitting as <span className="text-foreground">{user.email}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-foreground/10 bg-secondary/35 px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-9 min-w-33 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {loading ? (
                  <span className="animate-pulse">Sending...</span>
                ) : (
                  <>
                    <Send size={14} /> Submit
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;