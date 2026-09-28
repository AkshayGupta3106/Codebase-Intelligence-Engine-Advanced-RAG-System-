/**
 * src/components/RightPanel.jsx
 * Right sidebar: Sources, Graph, and Debug tabs.
 * Collapsible on desktop, drawer on mobile.
 */
import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { FileCode, Network, Bug, X, Maximize2, Minimize2 } from 'lucide-react';

// Lazy load reactflow since it's heavy
const ReactFlow = lazy(() => import('@xyflow/react').then(m => ({ default: m.ReactFlow })));
const Background = lazy(() => import('@xyflow/react').then(m => ({ default: m.Background })));
const Controls = lazy(() => import('@xyflow/react').then(m => ({ default: m.Controls })));
import '@xyflow/react/dist/style.css';

export default function RightPanel({ chunks, queryType, impactEdges, onClose, isMobile }) {
  // Default to graph if it's a graph query, else sources
  const defaultTab = (queryType === 'flow' || queryType === 'impact_analysis' || queryType === 'find_usage') && impactEdges?.length > 0 ? 'graph' : 'sources';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [expanded, setExpanded]   = useState(false); // only for desktop

  const hasChunks = chunks && chunks.length > 0;
  const hasGraph  = impactEdges && impactEdges.length > 0;

  return (
    <aside
      className="flex flex-col h-full shrink-0 glass"
      style={{
        borderLeft: '1px solid var(--border-base)',
        width: isMobile ? '100%' : expanded ? 'min(600px, 50vw)' : 'var(--right-panel-w)',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      aria-label="Details panel"
    >
      {/* ── Header / Tabs ── */}
      <div className="flex flex-col shrink-0" style={{ borderBottom: '1px solid var(--border-base)' }}>
        {/* Top actions */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('sources')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{
                background: activeTab === 'sources' ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === 'sources' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <FileCode size={13} />
              Sources
              {hasChunks && (
                <span className="ml-1 rounded px-1 text-[9px] font-mono" style={{ background: 'var(--bg-overlay)' }}>{chunks.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{
                background: activeTab === 'graph' ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === 'graph' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <Network size={13} />
              Graph
              {hasGraph && (
                <span className="ml-1 rounded px-1 text-[9px] font-mono" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{impactEdges.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('debug')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{
                background: activeTab === 'debug' ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === 'debug' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <Bug size={13} />
              Debug
            </button>
          </div>
          <div className="flex items-center gap-1">
            {!isMobile && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label={expanded ? "Collapse panel" : "Expand panel"}
              >
                {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded transition-colors hover:bg-[var(--bg-elevated)]"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close panel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'sources' && (
            <motion.div
              key="sources"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute inset-0 overflow-y-auto p-4 space-y-4"
            >
              {!hasChunks ? (
                <EmptyTab icon={<FileCode size={24} />} title="No sources" desc="Run a query to see retrieved file chunks here." />
              ) : (
                chunks.map((chunk, i) => <SourceCard key={chunk.id || i} chunk={chunk} index={i} />)
              )}
            </motion.div>
          )}

          {activeTab === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute inset-0 flex flex-col"
            >
              {!hasGraph ? (
                <EmptyTab icon={<Network size={24} />} title="No graph data" desc="Lineage is only shown for impact, flow, or find_usage queries." />
              ) : (
                <GraphView edges={impactEdges} />
              )}
            </motion.div>
          )}

          {activeTab === 'debug' && (
            <motion.div
              key="debug"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute inset-0 overflow-y-auto p-4"
            >
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Raw JSON Response</h3>
              <pre className="text-[10px] font-mono rounded-lg p-4 overflow-x-auto" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
                {JSON.stringify({ queryType, impactEdges, chunks: chunks?.map(c => ({ id: c.id, score: c.score, file: c.file_name })) }, null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

/* ── Source Card ──────────────────────────────────────────────────────────── */
function SourceCard({ chunk }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasMeta = chunk.name || chunk.type || chunk.start_line != null;
  const lines = chunk.start_line != null && chunk.end_line != null ? `L${chunk.start_line}-${chunk.end_line}` : chunk.start_line != null ? `L${chunk.start_line}` : '';
  
  const text = chunk.chunk_text || '';
  const isLong = text.split('\n').length > 10;

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl overflow-hidden transition-shadow shadow-lg hover:shadow-xl hover:border-violet-500/50" style={{ border: '1px solid var(--border-strong)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-[10px] font-semibold font-mono truncate" style={{ color: 'var(--text-primary)' }}>
            {chunk.file_name || 'unknown'}
          </span>
          {hasMeta && (
            <div className="flex items-center gap-1.5 shrink-0">
              {chunk.type && (
                <span className="text-[9px] font-mono px-1 rounded uppercase tracking-wider" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  {chunk.type}
                </span>
              )}
              {lines && <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{lines}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2">
          <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>
            {(chunk.score || 0).toFixed(3)}
          </span>
          <button onClick={copy} className="text-[9px] font-mono font-semibold uppercase tracking-wider transition-colors" style={{ color: copied ? 'var(--green)' : 'var(--text-secondary)' }}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      
      {/* Code */}
      <div className="relative">
        <pre className={`p-3 text-[11px] font-mono overflow-x-auto code-scroll ${isLong && !expanded ? 'max-h-40' : ''}`} style={{ color: 'var(--text-secondary)' }}>
          {text}
        </pre>
        {isLong && !expanded && (
          <div className="absolute bottom-0 inset-x-0 h-16 flex items-end justify-center pb-2 pointer-events-none"
            style={{ background: 'linear-gradient(transparent, var(--bg-base))' }}
          >
            <button onClick={() => setExpanded(true)} className="pointer-events-auto text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full transition-colors hover:bg-[var(--bg-elevated)]" style={{ color: 'var(--text-primary)' }}>
              Expand
            </button>
          </div>
        )}
        {expanded && (
          <button onClick={() => setExpanded(false)} className="w-full text-center py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors hover:bg-[var(--bg-elevated)]" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
            Collapse
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Graph View (ReactFlow) ───────────────────────────────────────────────── */
function GraphView({ edges }) {
  // Convert backend edges {model, column, depth, relation} into ReactFlow nodes/edges
  // Very simplistic auto-layout for demo
  const nodes = [];
  const rfEdges = [];
  
  if (edges && edges.length > 0) {
    // Collect unique nodes
    const unique = new Set();
    const levels = { upstream: [], center: [], downstream: [] };
    
    // Assume the query target is the center. 
    // In a real app, the API should return the source node name.
    const centerNode = edges[0].model; // simplification
    if (!unique.has(centerNode)) {
      unique.add(centerNode);
      levels.center.push(centerNode);
      nodes.push({ id: centerNode, data: { label: centerNode }, position: { x: 250, y: 150 }, type: 'default', style: { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: '8px', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', padding: '8px 12px' } });
    }

    let upY = 50;
    let dnY = 250;

    edges.forEach((e, i) => {
      const tgt = e.relation === 'upstream' ? e.model : centerNode;
      const src = e.relation === 'upstream' ? centerNode : e.model;
      const id = e.model;

      if (!unique.has(id)) {
        unique.add(id);
        const y = e.relation === 'upstream' ? upY : dnY;
        const x = 100 + (i * 120);
        if (e.relation === 'upstream') upY -= 60; else dnY += 60;

        nodes.push({
          id,
          data: { label: id },
          position: { x, y },
          style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-base)', borderRadius: '8px', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', padding: '8px 12px' }
        });
      }

      rfEdges.push({
        id: `e-${src}-${tgt}-${i}`,
        source: src,
        target: tgt,
        animated: true,
        style: { stroke: 'var(--accent-border)', strokeWidth: 1.5 }
      });
    });
  }

  return (
    <div className="flex-1 w-full h-full relative" style={{ background: 'var(--bg-base)' }}>
      <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">Loading Graph...</div>}>
        <ReactFlow nodes={nodes} edges={rfEdges} fitView attributionPosition="bottom-right">
          <Background color="var(--border-strong)" gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </Suspense>
      <div className="absolute top-3 right-3 text-[10px] font-mono px-2 py-1 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-base)' }}>
        {nodes.length} nodes
      </div>
    </div>
  );
}

function EmptyTab({ icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
      <div className="mb-4 opacity-40 text-[var(--text-muted)]">{icon}</div>
      <h3 className="text-sm font-semibold mb-1 text-[var(--text-primary)]">{title}</h3>
      <p className="text-xs text-[var(--text-muted)] max-w-[200px] leading-relaxed">{desc}</p>
    </div>
  );
}
