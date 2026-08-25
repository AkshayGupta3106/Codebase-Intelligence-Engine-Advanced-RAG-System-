import { motion, AnimatePresence } from "framer-motion";
import SourceCard from "./SourceCard";

// Intent badge config
const INTENT_CONFIG = {
  search: {
    label: "Search",
    color: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  explain: {
    label: "Explain",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
  },
  flow: {
    label: "Flow",
    color: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  find_usage: {
    label: "Find Usage",
    color: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
};

function IntentBadge({ queryType }) {
  if (!queryType) return null;
  const config = INTENT_CONFIG[queryType] || {
    label: queryType,
    color: "bg-white/10 text-slate-300 border-white/20",
    icon: null,
  };
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold font-mono-ide uppercase tracking-widest shadow-sm ${config.color}`}
    >
      {config.label}
    </motion.span>
  );
}

function LatencyBadge({ latencyMs }) {
  if (latencyMs == null) return null;
  const color =
    latencyMs < 400
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]"
      : latencyMs < 800
      ? "text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]"
      : "text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]";
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold font-mono-ide ${color}`}
    >
      {latencyMs}ms
    </motion.span>
  );
}

function AnswerPanel({ response, copiedKey, onCopy, isStreaming = false }) {
  const answerText = response?.answer || "";
  const queryType = response?.query_type || null;
  const latencyMs = response?.latency_ms ?? null;

  const flowHeader = "Flow Explanation:";
  const execHeader = "Execution Flow:";
  const flowHeaderIndex = answerText.toLowerCase().indexOf(flowHeader.toLowerCase());
  const execHeaderIndex = answerText.toLowerCase().indexOf(execHeader.toLowerCase());

  const hasFlowSection = flowHeaderIndex !== -1;
  const hasExecSection = execHeaderIndex !== -1;
  let mainAnswer = answerText.trim();
  let flowLines = [];

  if (hasFlowSection) {
    const beforeFlow = answerText.slice(0, flowHeaderIndex).trim();
    const afterFlow = answerText.slice(flowHeaderIndex + flowHeader.length).trim();
    let flowBlock = afterFlow;
    let trailingAnswer = "";
    const sectionBreak = afterFlow.search(/\n\s*\n/);
    if (sectionBreak !== -1) {
      flowBlock = afterFlow.slice(0, sectionBreak).trim();
      trailingAnswer = afterFlow.slice(sectionBreak).trim();
    }
    flowLines = flowBlock.split("\n").map((l) => l.trim()).filter(Boolean);
    mainAnswer = [beforeFlow, trailingAnswer].filter(Boolean).join("\n\n");
  } else if (hasExecSection) {
    const afterExec = answerText.slice(execHeaderIndex + execHeader.length).trim();
    flowLines = afterExec.split("\n").map((l) => l.trim()).filter(Boolean);
    mainAnswer = "";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 80 }}
      className="mx-auto w-full max-w-4xl space-y-8"
    >
      {/* Main Answer */}
      {(mainAnswer || isStreaming) && (
        <motion.section
          className="relative overflow-hidden rounded-xl border border-white/10 glass-panel shadow-2xl"
        >
          <div className="flex items-center border-b border-white/10 bg-black/40 px-4 py-3">
            <span className="text-[11px] font-mono-ide text-slate-300 font-bold uppercase tracking-widest mr-auto">Console Output</span>
            <div className="flex items-center gap-2">
              <IntentBadge queryType={queryType} />
              <LatencyBadge latencyMs={latencyMs} />
            </div>
          </div>
          
          <div className="p-4">
            {isStreaming && !mainAnswer ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 font-mono-ide">
                <span className="animate-pulse text-emerald-400 font-bold">_</span>
                Synthesizing response...
              </div>
            ) : (
              <div
                className="prose prose-invert max-w-none text-[13px] leading-relaxed text-slate-200"
                dangerouslySetInnerHTML={{ __html: mainAnswer }}
              />
            )}
          </div>
        </motion.section>
      )}

      {/* Flow / Execution Path */}
      {(hasFlowSection || hasExecSection) && flowLines.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl border border-indigo-500/30 glass-panel shadow-[0_0_30px_rgba(99,102,241,0.1)]"
        >
          <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-4 py-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest font-mono-ide text-indigo-300">
              Execution Flow
            </h3>
          </div>
          <div className="bg-black/20 p-4">
            <ul className="space-y-2">
              {flowLines.map((line, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-[10px] font-bold text-indigo-400">
                    {idx + 1}
                  </div>
                  <p className="text-[13px] leading-relaxed text-slate-200 font-mono-ide">{line.replace(/^-\s*/, "")}</p>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>
      )}

      {/* Source Chunks */}
      {Array.isArray(response?.retrieved_chunks) && response.retrieved_chunks.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="relative rounded-md border border-[#3c3c3c] bg-[#1e1e1e] p-0 shadow-lg"
        >
          <div className="flex items-center border-b border-[#3c3c3c] bg-[#252526] px-4 py-2">
            <span className="text-xs font-mono-ide text-[#cccccc]">Reference Search Results</span>
            <span className="ml-auto text-[10px] font-mono-ide text-[#858585]">
              {response.retrieved_chunks.length} result{response.retrieved_chunks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="p-4 grid gap-4 bg-[#1e1e1e]">
            {response.retrieved_chunks.map((chunk, index) => (
              <SourceCard
                key={chunk.id || `${chunk.file_name || "chunk"}-${index}`}
                chunk={chunk}
                index={index}
                copiedKey={copiedKey}
                onCopy={onCopy}
              />
            ))}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}

export default AnswerPanel;
