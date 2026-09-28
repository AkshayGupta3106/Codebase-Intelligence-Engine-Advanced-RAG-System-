/**
 * src/components/Sidebar.jsx
 * Left sidebar: repo indexing, file upload, indexed repos list, health status.
 */
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import {
  Upload, FolderOpen, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronRight, Database, Cpu, HardDrive, X
} from 'lucide-react';
import { indexRepo, ingestFile } from '../lib/api';

const ALLOWED_EXTS = ['.py', '.go', '.js', '.ts', '.jsx', '.tsx', '.sql', '.yml', '.yaml'];

export default function Sidebar({ healthStatus, onClose, isMobile }) {
  /* Repo indexer state */
  const [repoUrl, setRepoUrl]           = useState('');
  const [repoStatus, setRepoStatus]     = useState(null); // null | 'loading' | 'ok' | 'error'
  const [repoMsg, setRepoMsg]           = useState('');
  const [indexedRepos, setIndexedRepos] = useState([]);

  /* File ingestion state */
  const [file, setFile]           = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileStatus, setFileStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [fileMsg, setFileMsg]       = useState('');
  const fileInputRef = useRef(null);

  /* Health panel open */
  const [healthOpen, setHealthOpen] = useState(true);

  /* ── Repo indexing ─────────────────────────────────────────────────── */
  const handleIndexRepo = useCallback(async () => {
    const url = repoUrl.trim();
    if (!url || repoStatus === 'loading') return;
    if (!/^https?:\/\//i.test(url)) {
      setRepoMsg('Enter a valid http/https URL'); setRepoStatus('error'); return;
    }
    setRepoStatus('loading'); setRepoMsg('');
    try {
      await indexRepo(url);
      setRepoStatus('ok');
      setRepoMsg('Repository indexed!');
      setIndexedRepos(prev => {
        const shortName = url.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
        return [{ url, name: shortName || url }, ...prev.filter(r => r.url !== url)];
      });
      setRepoUrl('');
    } catch (err) {
      setRepoStatus('error');
      setRepoMsg(err.message || 'Indexing failed');
    }
  }, [repoUrl, repoStatus]);

  /* ── File ingestion ─────────────────────────────────────────────────── */
  const selectFile = useCallback((f) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!ALLOWED_EXTS.some(ext => lower.endsWith(ext))) {
      setFileStatus('error');
      setFileMsg(`Unsupported file. Allowed: ${ALLOWED_EXTS.join(' ')}`);
      setFile(null); return;
    }
    setFile(f); setFileStatus(null); setFileMsg('');
  }, []);

  const handleIngest = useCallback(async () => {
    if (!file || fileStatus === 'loading') return;
    setFileStatus('loading'); setFileMsg('');
    try {
      const res = await ingestFile(file);
      setFileStatus('ok');
      setFileMsg(`Ingested ${res.chunk_count} chunks from ${res.filename}`);
      setFile(null);
    } catch (err) {
      setFileStatus('error');
      setFileMsg(err.message || 'Upload failed');
    }
  }, [file, fileStatus]);

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <aside
      className="flex h-full flex-col overflow-y-auto glass"
      style={{
        borderRight: '1px solid var(--border-base)',
        width: isMobile ? '100%' : 'var(--sidebar-w)',
      }}
      aria-label="Sidebar"
    >
      {/* Mobile header */}
      {isMobile && (
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-base)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Workspace</span>
          <button onClick={onClose} aria-label="Close sidebar" style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-0 flex-1 p-3 space-y-3">

        {/* ── Index Repository ───────────────────────────────────────── */}
        <SectionCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>} title="Index Repository">
          <p className="text-[11px] leading-relaxed font-mono mb-3" style={{ color: 'var(--text-muted)' }}>
            Paste a public GitHub URL to clone, parse, and index.
          </p>
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleIndexRepo()}
            placeholder="https://github.com/owner/repo"
            aria-label="GitHub repository URL"
            className="w-full rounded-lg px-3 py-2 text-xs font-mono outline-none transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-base)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-base)'}
          />
          <button
            onClick={handleIndexRepo}
            disabled={!repoUrl.trim() || repoStatus === 'loading'}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)', color: '#fff', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            {repoStatus === 'loading'
              ? <><Loader2 size={12} className="animate-spin" /> Indexing…</>
              : <><FolderOpen size={12} /> Run Indexer</>}
          </button>
          <p className="mt-1 text-[10px] font-mono" style={{ color: 'var(--text-xmuted)' }}>
            Max 100 files · 200 KB each
          </p>
          <StatusMsg status={repoStatus} msg={repoMsg} />
        </SectionCard>

        {/* ── Indexed repos list ────────────────────────────────────── */}
        {indexedRepos.length > 0 && (
          <SectionCard icon={<CheckCircle2 size={13} />} title="Indexed">
            <ul className="space-y-1">
              {indexedRepos.map(r => (
                <li key={r.url} className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] font-mono truncate"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--green)' }} />
                  {r.name}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* ── Ingest File ───────────────────────────────────────────── */}
        <SectionCard icon={<Upload size={13} />} title="Ingest File">
          {/* Drop zone */}
          <div
            className="relative flex flex-col items-center gap-2 rounded-lg py-5 px-3 text-center transition-all"
            style={{
              border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-base)'}`,
              background: isDragging ? 'var(--accent-dim)' : 'var(--bg-elevated)',
            }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); selectFile(e.dataTransfer.files[0]); }}
          >
            <Upload size={16} style={{ color: 'var(--text-muted)' }} />
            <p className="text-[11px] font-semibold" style={{ color: file ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {file ? file.name : 'Drop a file here'}
            </p>
            {!file && (
              <p className="text-[10px] font-mono" style={{ color: 'var(--text-xmuted)' }}>
                .py .go .js .ts .jsx .tsx .sql .yml
              </p>
            )}
            <label className="cursor-pointer rounded px-3 py-1 text-[10px] font-semibold transition-colors"
              style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-base)', color: 'var(--text-secondary)' }}>
              Browse
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ALLOWED_EXTS.join(',')}
                onChange={e => selectFile(e.target.files[0])}
              />
            </label>
          </div>
          <button
            onClick={handleIngest}
            disabled={!file || fileStatus === 'loading'}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid var(--accent-border)', color: 'var(--accent)', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
          >
            {fileStatus === 'loading'
              ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
              : <><Upload size={12} /> Ingest</>}
          </button>
          <StatusMsg status={fileStatus} msg={fileMsg} />
        </SectionCard>

        {/* ── Health ───────────────────────────────────────────────── */}
        <SectionCard
          icon={<Database size={13} />}
          title="System Health"
          collapsible
          open={healthOpen}
          onToggle={() => setHealthOpen(v => !v)}
        >
          <div className="space-y-1.5">
            <HealthRow icon={<HardDrive size={11} />} label="Qdrant"    ok={healthStatus?.qdrant}    />
            <HealthRow icon={<Database size={11}  />} label="Postgres"  ok={healthStatus?.postgres}   />
            <HealthRow icon={<Cpu size={11}      />}
              label={healthStatus
                ? (healthStatus.gemini_configured ? 'Gemini' : healthStatus.groq_configured ? 'Groq' : 'Local LLM')
                : 'LLM'}
              ok={healthStatus?.gemini_configured || healthStatus?.groq_configured || false}
            />
          </div>
        </SectionCard>
      </div>
    </aside>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
function SectionCard({ icon, title, children, collapsible, open, onToggle }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: '1px solid var(--border-base)', background: 'rgba(0,0,0,0.2)' }}>
      <div
        className={`flex items-center gap-2 px-4 py-3 ${collapsible ? 'cursor-pointer select-none hover:bg-white/5 transition-colors' : ''}`}
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}
        onClick={collapsible ? onToggle : undefined}
      >
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-widest font-mono" style={{ color: 'var(--text-secondary)' }}>
          {title}
        </span>
        {collapsible && (
          open ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
               : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
      <AnimatePresence initial={false}>
        {(!collapsible || open) && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HealthRow({ icon, label, ok }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {ok == null
        ? <span className="text-[10px]" style={{ color: 'var(--text-xmuted)' }}>—</span>
        : ok
        ? <span className="flex items-center gap-1" style={{ color: 'var(--green)' }}><CheckCircle2 size={10} /> OK</span>
        : <span className="flex items-center gap-1" style={{ color: 'var(--red)' }}><XCircle size={10} /> Down</span>
      }
    </div>
  );
}

function StatusMsg({ status, msg }) {
  if (!msg) return null;
  const color = status === 'ok' ? 'var(--green)' : status === 'error' ? 'var(--red)' : 'var(--text-secondary)';
  return (
    <AnimatePresence>
      <motion.p
        key={msg}
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="mt-2 text-[11px] font-mono text-center"
        style={{ color }}
      >
        {msg}
      </motion.p>
    </AnimatePresence>
  );
}
