const Badge = ({ text, className = '' }: { text: string; className?: string }) => (
  <div
    className={`absolute -bottom-6 left-0 px-2 py-0.5 rounded-lg text-[10px] font-mono flex items-center gap-1 shadow-sm ${className}`}
  >
    <span className="opacity-60">↳</span> {text}
  </div>
);

export const IntelligentExecutionGraph = () => {
  return (
    <div className="relative w-full h-150">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        style={{ stroke: 'rgba(26,29,41,0.15)', fill: 'none', strokeWidth: 1.5 }}
      >
        <path
          d="M -50 450 C 100 450, 150 450, 200 450 C 250 450, 280 430, 300 400 C 330 350, 350 350, 400 350"
          strokeDasharray="4 4"
          className="animate-[dash_20s_linear_infinite]"
        />

        <path d="M 150 450 C 200 450, 200 380, 250 380" />
        <path d="M 280 380 C 320 380, 320 350, 350 350" />
        <path d="M 380 350 C 450 350, 450 250, 500 250" />
        <path d="M 380 350 C 450 350, 450 450, 500 450" />
        <path d="M 380 350 C 450 350, 480 180, 520 180" />

        <path d="M 520 180 C 580 180, 580 120, 620 120" />
        <path d="M 520 180 C 580 180, 580 220, 620 220" />

        <path d="M 620 120 C 660 120, 660 60, 700 60" />
        <path d="M 700 60 L 800 60" />

        <circle cx="150" cy="450" r="3" fill="var(--hex-ink)" opacity="0.3" />
        <circle cx="280" cy="380" r="3" fill="var(--hex-ink)" opacity="0.3" />
        <circle cx="380" cy="350" r="3" fill="var(--hex-ink)" opacity="0.3" />
        <circle cx="520" cy="180" r="3" fill="var(--hex-ink)" opacity="0.3" />
        <circle cx="700" cy="60" r="3" fill="var(--hex-ink)" opacity="0.3" />
        <circle cx="800" cy="60" r="3" fill="var(--c-purple)" stroke="none" />

        <circle r="2" fill="var(--c-purple)" stroke="none">
          <animateMotion dur="4s" repeatCount="indefinite" path="M 150 450 C 200 450, 200 380, 250 380" />
        </circle>
        <circle r="2" fill="var(--c-purple)" stroke="none">
          <animateMotion dur="6s" repeatCount="indefinite" path="M 380 350 C 450 350, 450 250, 500 250" />
        </circle>
        <circle r="2" fill="var(--c-purple)" stroke="none">
          <animateMotion dur="5s" repeatCount="indefinite" path="M 520 180 C 580 180, 580 120, 620 120" />
        </circle>
        <circle r="2" fill="var(--c-purple)" stroke="none">
          <animateMotion dur="7s" repeatCount="indefinite" path="M 620 120 C 660 120, 660 60, 700 60" />
        </circle>
      </svg>

      <div className="absolute left-0 top-75 w-48 bg-white rounded-md shadow-lg border border-slate-200 p-3 z-10 flex flex-col gap-2">
        <div className="text-[10px] text-slate-400 font-normal mb-1">Logic Router</div>
        <div className="border border-slate-100 rounded grid grid-cols-2 text-[8px] bg-slate-50 overflow-hidden font-normal">
          <div className="p-1 border-b border-r border-slate-100 bg-slate-100/50">
            Rule 1
            <br />
            SCORE &lt; 5
          </div>
          <div className="p-1 border-b border-slate-100">
            <div className="h-1 w-full bg-slate-200 rounded mb-1" />
            <div className="h-1 w-3/4 bg-slate-200 rounded" />
          </div>
          <div className="p-1 border-b border-r border-slate-100 bg-slate-100/50">
            Rule 2
            <br />
            SENTIMENT
          </div>
          <div className="p-1 border-b border-slate-100">
            <div className="h-1 w-full bg-slate-200 rounded mb-1" />
            <div className="h-1 w-5/6 bg-slate-200 rounded" />
          </div>
          <div className="p-1 border-r border-slate-100 bg-slate-100/50">
            Default
            <br />
            CONTINUE
          </div>
          <div className="p-1">
            <div className="h-1 w-full bg-slate-200 rounded mb-1" />
            <div className="h-1 w-1/2 bg-slate-200 rounded" />
          </div>
        </div>
        <Badge text="branch_path" className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-normal" />
      </div>

      <div className="absolute left-37.5 top-107.5 w-48 bg-white rounded-md shadow-lg border border-slate-200 p-3 z-10">
        <div className="text-[10px] text-slate-400 font-normal mb-2">Validation Check</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500 p-1 rounded font-normal">
            <span>SCORE</span> <span className="opacity-40">&lt;</span>{' '}
            <span className="text-slate-500">5</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500 p-1 rounded font-normal">
            <span className="opacity-40">AND</span> <span>SENTIMENT</span>{' '}
            <span className="text-slate-400">is</span> <span>Negative</span>
          </div>
        </div>
        <Badge text="routing_condition" className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-normal" />
      </div>

      <div className="absolute left-62.5 top-70 w-56 bg-white rounded-md shadow-lg border border-slate-200 p-3 z-10">
        <div className="text-[10px] text-slate-400 font-normal mb-2">AI Prompt Engine</div>
        <div className="text-[9px] font-mono leading-[1.6] font-normal">
          <span className="text-[#3b82f6]">generate</span> follow_up_questions
          <br />
          &nbsp;&nbsp;<span className="text-[#3b82f6]">from</span> (
          <span className="text-[#ec4899]">context</span> session_data){' '}
          <br />
          <span className="text-[#3b82f6]">where</span> sentiment = ((
          <span className="text-[#4f46e5]">negative</span>
          ))
          <br />
          <span className="text-[#3b82f6]">using</span> prompt_template(<span className="text-[#10b981]">{"'churn_risk'"}</span>)
        </div>
        <Badge text="ai_response" className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-normal" />
      </div>

      <div className="absolute left-100 top-80 w-32 bg-white/95 backdrop-blur-md rounded-md shadow-md border hex-line-soft p-3 z-10">
        <div className="text-[10px] text-slate-400 font-normal mb-2">User Input</div>
        <div className="flex items-center justify-between bg-slate-50 border hex-line-soft text-slate-700 font-normal text-[10px] px-2 py-1.5 rounded">
          Very Dissatisfied
          <span className="opacity-40 text-[8px]">▼</span>
        </div>
        <Badge text="user_score" className="bg-slate-100 border border-slate-200 text-slate-600 font-normal" />
      </div>

      <div className="absolute left-95 top-25 w-48 bg-white/95 backdrop-blur-md rounded-md shadow-md border hex-line-soft p-4 z-10">
        <div className="text-[8px] font-medium text-slate-400 uppercase tracking-widest mb-3 text-center">
          SYNC DESTINATIONS
        </div>
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 rounded-full bg-[#38bdf8] flex items-center justify-center text-white text-[10px] font-normal">
            S
          </div>
          <div className="w-5 h-5 rounded-full bg-[#1d4ed8] flex items-center justify-center text-white text-[10px] font-normal">
            B
          </div>
          <div className="w-5 h-5 rounded-full bg-slate-400 flex items-center justify-center text-white text-[10px] font-normal">
            A
          </div>
          <div className="w-5 h-5 rounded-full bg-[#ec4899] flex items-center justify-center text-white text-[10px] font-normal">
            D
          </div>
          <div className="w-5 h-5 rounded-full bg-slate-500 flex items-center justify-center text-white text-[10px] font-normal">
            X
          </div>
        </div>
        <div className="text-[9px] text-slate-400 text-center mt-3 font-normal">And more...</div>
      </div>

      <div className="absolute left-125 top-60 w-24 h-12 bg-slate-50/80 border hex-line-soft rounded shadow-sm z-0" />
      <div className="absolute left-125 top-110 w-20 h-8 bg-slate-50/80 border hex-line-soft rounded shadow-sm z-0" />
      <div className="absolute left-155 top-27.5 w-16 h-6 bg-slate-50/80 border hex-line-soft rounded shadow-sm z-0" />
      <div className="absolute left-155 top-52.5 w-24 h-8 bg-slate-50/80 border hex-line-soft rounded shadow-sm z-0" />
      <div className="absolute left-165 top-12.5 w-12 h-6 bg-slate-50/80 border hex-line-soft rounded shadow-sm z-0" />
    </div>
  );
};