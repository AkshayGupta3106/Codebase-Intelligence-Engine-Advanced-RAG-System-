import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Colour & icon per chunk type
const TYPE_CONFIG = {
  function: {
    label: "fn",
    color: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  },
  method: {
    label: "method",
    color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  },
  class: {
    label: "class",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  },
  module: {
    label: "module",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  },
  model: {
    label: "model",
    color: "bg-[#0e639c] text-white border-[#0e639c]",
  },
  macro: {
    label: "macro",
    color: "bg-[#6a9955] text-white border-[#6a9955]",
  }
};

function TypeBadge({ type }) {
  if (!type) return null;
  const config = TYPE_CONFIG[type.toLowerCase()] || {
    label: type,
    color: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  };
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[9px] font-mono-ide uppercase tracking-widest ${config.color}`}
    >
      {config.label}
    </span>
  );
}

function SourceCard({ chunk, index, copiedKey, onCopy }) {
  const [expanded, setExpanded] = useState(false);

  const hasMetadata = chunk.name || chunk.type || chunk.start_line != null;
  const lineRange =
    chunk.start_line != null && chunk.end_line != null
      ? `L${chunk.start_line}–${chunk.end_line}`
      : chunk.start_line != null
      ? `L${chunk.start_line}`
      : null;

  const codeText = chunk.chunk_text || "";
  const isLong = codeText.split("\n").length > 12;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, type: "spring" }}
      className="group relative overflow-hidden rounded-xl border border-white/10 glass-panel shadow-lg hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(52,211,153,0.1)] transition-all duration-300"
    >

      {/* ── Header row ── */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          </svg>
          <span className="text-xs font-bold font-mono-ide text-slate-200">
            {chunk.file_name || "Unknown file"}
          </span>
          {/* Name + type + line range */}
          {hasMetadata && (
            <div className="flex items-center gap-1.5 ml-2">
              <TypeBadge type={chunk.type} />
              {lineRange && (
                <span className="text-[10px] text-slate-500 font-bold font-mono-ide bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{lineRange}</span>
              )}
            </div>
          )}
        </div>

        {/* Score + copy */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="text-[10px] font-bold font-mono-ide">
              Score: {Number(chunk.score || 0).toFixed(3)}
            </span>
          </div>
          <button
            onClick={() => onCopy(chunk.chunk_text || "", `chunk-${index}`)}
            className="text-[10px] font-bold font-mono-ide text-slate-400 hover:text-emerald-400 transition-colors"
          >
            {copiedKey === `chunk-${index}` ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* ── Docstring ── */}
      {chunk.docstring && (
        <div className="bg-emerald-500/5 border-b border-emerald-500/10 px-4 py-2.5">
          <p className="text-[11px] font-mono-ide text-emerald-400/80 italic font-medium leading-relaxed">
            /* {chunk.docstring} */
          </p>
        </div>
      )}

      {/* ── Code block ── */}
      <div className="bg-transparent">
        <pre
          className={`code-scroll overflow-auto bg-transparent px-4 py-3 font-mono-ide text-[13px] leading-relaxed text-slate-200 transition-all duration-300 ${
            isLong && !expanded ? "max-h-48" : "max-h-none"
          }`}
        >
          {codeText || "No code available."}
        </pre>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full border-t border-white/10 bg-black/40 py-2 text-center text-[10px] font-bold font-mono-ide text-slate-400 hover:bg-black/60 hover:text-emerald-400 transition-colors"
          >
            {expanded ? "Collapse" : "Show more"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default SourceCard;
