import { motion } from "framer-motion";
import { useState } from "react";

function QueryInput({ query, setQuery, onSubmit, loading }) {
  const [isFocused, setIsFocused] = useState(false);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl relative group">
      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-xl border border-white/10 glass-panel shadow-2xl transition-all duration-500 ease-out sm:flex-row ${
          isFocused
            ? "border-emerald-500/50 shadow-[0_0_30px_rgba(52,211,153,0.15)] bg-black/60"
            : "hover:border-white/20 hover:bg-black/40 bg-black/20"
        }`}
      >
        <div className="flex flex-1 items-center">
          {/* Gutter / Line Number */}
          <div className="flex h-full w-12 shrink-0 items-center justify-center border-r border-white/5 bg-white/5 text-[11px] font-mono-ide text-slate-500">
            1
          </div>

          <input
            id="search-query-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="SELECT * FROM codebase WHERE ..."
            className="w-full bg-transparent px-4 py-3.5 text-sm font-mono-ide font-medium tracking-wide text-emerald-400 placeholder:text-slate-600 focus:outline-none placeholder:italic"
          />
        </div>

        {/* Keyboard shortcut hint */}
        <div className="hidden shrink-0 items-center px-4 sm:flex">
          <kbd className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] font-bold font-mono-ide text-slate-400">
            <span className="text-xs">⌘</span> K
          </kbd>
        </div>

        <button
          type="submit"
          onClick={onSubmit}
          disabled={loading || !query.trim()}
          className="group flex h-full shrink-0 items-center justify-center gap-2 border-l border-white/5 bg-emerald-500/10 px-6 py-3.5 text-[11px] font-bold font-mono-ide uppercase tracking-widest text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-600 hover:shadow-[inset_0_0_20px_rgba(52,211,153,0.1)]"
        >
          {loading ? (
             <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : (
             <>
               Run
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
             </>
          )}
        </button>
      </div>
    </div>
  );
}

export default QueryInput;
