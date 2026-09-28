/**
 * src/components/ChatPanel.jsx
 * Center conversation area: empty state, input bar, streaming answer, messages list.
 */
import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Send, Square, Copy, Check, Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import IntentBadge from './IntentBadge';

// Lazy-load ReactMarkdown + remark-gfm (heavy)
const ReactMarkdown = lazy(() => import('react-markdown'));

const EXAMPLE_QUERIES = [
  'Which functions call authenticate_user()?',
  'What breaks if I modify stg_orders?',
  'Explain the core RAG pipeline logic.',
  'Find all usages of the embed() helper.',
];

let _msgId = 0;

export default function ChatPanel({
  onAnswer,          // callback(answer, chunks, queryType, impactEdges)
  streamHook,        // { status, answer, queryType, latencyMs, impactEdges, start, stop }
}) {
  const { status, answer, queryType, latencyMs, impactEdges, start, stop } = streamHook;

  const [query, setQuery]     = useState('');
  const [messages, setMessages] = useState([]); // { id, query, answer, queryType, latencyMs, impactEdges }
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const prevStatus = useRef('idle');

  /* When streaming finishes → save message */
  useEffect(() => {
    if (prevStatus.current === 'streaming' && status === 'done' && answer) {
      const last = messages[messages.length - 1];
      if (!last || last.status !== 'streaming') return; // already saved
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, status: 'done', answer, queryType, latencyMs, impactEdges }
          : m
      ));
      onAnswer?.(answer, [], queryType, impactEdges);
    }
    prevStatus.current = status;
  }, [status, answer, queryType, latencyMs, impactEdges]); // eslint-disable-line

  /* Scroll to bottom on new content */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, answer]);

  /* Update the streaming message live */
  useEffect(() => {
    if (status === 'streaming') {
      setMessages(prev => {
        if (prev.length === 0 || prev[prev.length - 1].status !== 'streaming') return prev;
        return prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, answer } : m
        );
      });
    }
  }, [answer, status]);

  const runQuery = useCallback((q) => {
    if (!q || status === 'connecting' || status === 'streaming') return;

    const id = ++_msgId;
    setMessages(prev => [...prev, { id, query: q, answer: '', status: 'streaming', queryType: null, latencyMs: null, impactEdges: null }]);
    setQuery('');
    start(q, 5);
  }, [status, start]);

  const handleSubmit = useCallback(() => {
    runQuery(query.trim());
  }, [query, runQuery]);

  const handleExampleClick = (q) => {
    runQuery(q);
  };

  useEffect(() => {
    const onCustomSubmit = (e) => {
      if (e.detail) runQuery(e.detail);
    };
    window.addEventListener('app:submit-query', onCustomSubmit);
    return () => window.removeEventListener('app:submit-query', onCustomSubmit);
  }, [runQuery]);

  const isActive = status === 'connecting' || status === 'streaming';

  /* ── Cold-start detection: if "connecting" for > 12s show banner */
  const [slowWarn, setSlowWarn] = useState(false);
  useEffect(() => {
    if (status === 'connecting') {
      const t = setTimeout(() => setSlowWarn(true), 12000);
      return () => clearTimeout(t);
    } else {
      setSlowWarn(false);
    }
  }, [status]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>

      {/* ── Conversation scroll area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6" role="log" aria-live="polite" aria-label="Conversation">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
            <div className="mb-8 relative group cursor-default">
              {/* Glowing hero background */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-sky-500 to-emerald-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
              
              <div className="relative flex items-center justify-center w-20 h-20 mx-auto mb-6 rounded-3xl bg-black/40 border border-white/10 shadow-2xl backdrop-blur-xl">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className="text-white">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight text-white">
                Codebase <span className="text-gradient">Intelligence</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
                Index a repository or upload a file to instantly map call graphs, trace lineage, and ask questions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => handleExampleClick(q)}
                  className="rounded-lg px-3 py-2.5 text-left text-xs transition-all"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-base)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-base)';
                    e.currentTarget.style.background = 'var(--bg-surface)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} isStreaming={msg.status === 'streaming'} />
        ))}

        {/* Error state */}
        {status === 'error' && streamHook.error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl p-4 mx-auto max-w-2xl"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}
          >
            <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--red)' }}>
                {streamHook.error.toLowerCase().includes('failed to fetch') || streamHook.error.includes('502') || streamHook.error.includes('503')
                  ? 'Waking up the server…'
                  : 'Query failed'}
              </p>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{streamHook.error}</p>
              {(streamHook.error.includes('502') || streamHook.error.includes('503') || streamHook.error.toLowerCase().includes('failed to fetch')) && (
                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  The backend is on a free Render tier and may be cold-starting. Retry in ~30s.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Cold-start warning */}
        {slowWarn && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg mx-auto max-w-lg text-center"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
          >
            <RotateCcw size={11} className="animate-spin" />
            Waking up the server… this may take 20–40s on first request.
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div
          className="flex items-center gap-0 rounded-2xl overflow-hidden transition-all duration-300 focus-within:ring-2 focus-within:ring-violet-500/30"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Line number gutter */}
          <div className="flex items-center justify-center w-12 shrink-0 self-stretch font-mono text-[11px] select-none"
            style={{ background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-subtle)', color: 'var(--accent)' }}>
            ~
          </div>

          <input
            ref={inputRef}
            id="main-query-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder="Ask anything about the codebase…"
            disabled={isActive}
            autoComplete="off"
            spellCheck={false}
            aria-label="Query input"
            className="flex-1 bg-transparent px-4 py-3.5 text-sm font-mono outline-none disabled:opacity-50 placeholder:italic"
            style={{ color: 'var(--text-primary)' }}
          />

          {/* Kbd hint */}
          <kbd className="hidden md:inline-flex items-center px-2 text-[10px] font-mono mr-2 shrink-0 rounded"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-xmuted)', border: '1px solid var(--border-subtle)', padding: '2px 6px' }}>
            ↵
          </kbd>

          {/* Stop / Submit */}
          {isActive ? (
            <button
              onClick={stop}
              aria-label="Stop generation"
              className="flex h-full items-center gap-1.5 px-5 py-3.5 text-xs font-semibold transition-colors shrink-0"
              style={{ background: 'rgba(248,113,113,0.12)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--red)' }}
            >
              <Square size={12} />
              Stop
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!query.trim()}
              aria-label="Submit query"
              className="group flex h-full items-center gap-2 px-6 py-4 text-xs font-bold transition-all disabled:opacity-30 shrink-0 uppercase tracking-widest"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)', borderLeft: '1px solid var(--border-subtle)', color: '#fff' }}
            >
              Run
              <Send size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Single message item ──────────────────────────────────────────────────── */
function MessageItem({ msg, isStreaming }) {
  const [copied, setCopied] = useState(false);
  const [remarkGfmPlugin, setRemarkGfmPlugin] = useState(null);

  useEffect(() => {
    import('remark-gfm').then(m => setRemarkGfmPlugin(() => m.default)).catch(() => {});
  }, []);

  const copyAnswer = useCallback(() => {
    if (!msg.answer) return;
    navigator.clipboard.writeText(msg.answer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [msg.answer]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 18 }}
      className="mx-auto w-full max-w-2xl space-y-3"
    >
      {/* User query */}
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-tr-sm px-5 py-3.5 text-[13px] leading-relaxed shadow-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(56,189,248,0.1) 100%)',
            border: '1px solid rgba(139,92,246,0.25)',
            color: 'var(--text-primary)',
          }}
        >
          {msg.query}
        </div>
      </div>

      {/* Answer card */}
      <div
        className="rounded-2xl overflow-hidden shadow-2xl glass"
      >
        {/* Card header */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
          <span className="text-[10px] font-mono uppercase tracking-widest mr-auto" style={{ color: 'var(--text-muted)' }}>
            Response
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--accent)' }}>
              <span className="h-1.5 w-1.5 rounded-full animate-ping-dot" style={{ background: 'var(--accent)', display: 'inline-block' }} />
              Streaming
            </span>
          )}
          {msg.queryType && !isStreaming && <IntentBadge queryType={msg.queryType} />}
          {msg.latencyMs != null && !isStreaming && (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono"
              style={{
                background: msg.latencyMs < 500 ? 'rgba(52,211,153,0.10)' : msg.latencyMs < 1200 ? 'rgba(251,191,36,0.10)' : 'rgba(248,113,113,0.10)',
                border: '1px solid ' + (msg.latencyMs < 500 ? 'rgba(52,211,153,0.25)' : msg.latencyMs < 1200 ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'),
                color: msg.latencyMs < 500 ? 'var(--green)' : msg.latencyMs < 1200 ? 'var(--amber)' : 'var(--red)',
              }}>
              <Clock size={9} />
              {msg.latencyMs}ms
            </span>
          )}
        </div>

        {/* Answer body */}
        <div className={`px-5 py-4 ${isStreaming && !msg.answer ? 'stream-cursor' : ''}`}>
          {!msg.answer && isStreaming ? (
            <span className="text-sm font-mono stream-cursor" style={{ color: 'var(--text-muted)' }}>
              Synthesizing…
            </span>
          ) : (
            <div className={`prose ${isStreaming ? 'stream-cursor' : ''}`}>
              <Suspense fallback={<pre className="text-xs" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{msg.answer}</pre>}>
                <ReactMarkdown remarkPlugins={remarkGfmPlugin ? [remarkGfmPlugin] : []}>
                  {msg.answer || ''}
                </ReactMarkdown>
              </Suspense>
            </div>
          )}
        </div>

        {/* Copy footer */}
        {msg.answer && !isStreaming && (
          <div className="flex justify-end px-4 py-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={copyAnswer}
              className="flex items-center gap-1.5 text-[10px] font-mono transition-colors"
              style={{ color: copied ? 'var(--green)' : 'var(--text-muted)' }}
              aria-label="Copy answer"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Skeleton while connecting */}
      {isStreaming && !msg.answer && (
        <SkeletonLines />
      )}
    </motion.div>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-2 px-1">
      {[0.95, 1, 0.7, 0.85].map((w, i) => (
        <div
          key={i}
          className="skeleton h-3 rounded-full"
          style={{ width: `${w * 100}%`, animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}
