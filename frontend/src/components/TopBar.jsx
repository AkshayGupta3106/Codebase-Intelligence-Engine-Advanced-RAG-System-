/**
 * src/components/TopBar.jsx
 * Fixed top bar: logo, command palette trigger, theme toggle, GitHub link.
 */
import { Moon, Sun, Command } from 'lucide-react';

export default function TopBar({ theme, onThemeToggle, onCommandOpen, healthStatus }) {
  const llmLabel = healthStatus?.gemini_configured
    ? 'Gemini'
    : healthStatus?.groq_configured
    ? 'Groq'
    : 'Local';

  return (
    <header
      style={{ height: 'var(--topbar-h)' }}
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b px-4 shrink-0"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-base)', height: 'var(--topbar-h)' }}
      role="banner"
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
        <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Codebase <span style={{ color: 'var(--accent)' }}>Intelligence</span>
        </span>
      </div>

      {/* ── Center: Command palette trigger ── */}
      <button
        id="cmd-palette-trigger"
        onClick={onCommandOpen}
        aria-label="Open command palette (Ctrl+K)"
        className="hidden md:flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-base)',
          color: 'var(--text-muted)',
        }}
      >
        <Command size={11} />
        <span className="font-mono">Type a query or command…</span>
        <kbd className="ml-2 rounded px-1 py-0.5 text-[10px] font-mono" style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}>⌘K</kbd>
      </button>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-3">
        {/* Health pill */}
        {healthStatus && (
          <div
            className="hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-muted)' }}
          >
            <StatusDot ok={healthStatus.qdrant} label="Qdrant" />
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <StatusDot ok={healthStatus.postgres} label="PG" />
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span style={{ color: 'var(--text-secondary)' }}>{llmLabel}</span>
          </div>
        )}

        {/* Author Credit */}
        <span className="hidden sm:inline-flex text-[10px] font-mono uppercase tracking-widest text-slate-400 mr-2 border-r border-[var(--border-strong)] pr-3" style={{ opacity: 0.6 }}>
          by Akshay Gupta
        </span>

        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          aria-label="Toggle theme"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* GitHub */}
        <a
          href="https://github.com/AkshayGupta3106/Codebase-Intelligence-Engine-Advanced-RAG-System-"
          target="_blank" rel="noreferrer"
          aria-label="GitHub repository"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
        </a>
      </div>
    </header>
  );
}

function StatusDot({ ok, label }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: ok ? 'var(--green)' : 'var(--red)' }}
        title={`${label}: ${ok ? 'ok' : 'down'}`}
      />
      <span>{label}</span>
    </span>
  );
}
