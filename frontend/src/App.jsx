import { useState, useEffect, useCallback } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import RightPanel from './components/RightPanel';
import CommandPalette from './components/CommandPalette';
import { useStream } from './hooks/useStream';
import { fetchHealth } from './lib/api';
import './index.css';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [cmdOpen, setCmdOpen] = useState(false);
  
  // Health
  const [health, setHealth] = useState(null);
  
  // Mobile / desktop layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  // The stream hook for the central chat
  const streamHook = useStream();
  const { queryType, impactEdges } = streamHook;
  
  // We need to keep track of the *last successfully returned chunks* to pass to RightPanel
  const [lastChunks, setLastChunks] = useState([]);

  useEffect(() => {
    // Initial health check
    fetchHealth().then(setHealth).catch(() => {});
    
    // Resize listener
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    
    // Command palette listener
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    
    // Set theme class on root
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('light');
    else root.classList.remove('light');

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [theme]);

  // Pass this to ChatPanel so it can update RightPanel when stream finishes
  const handleAnswer = useCallback((answer, chunks = []) => {
    // If the stream finishes and we need to fetch chunks, we'd do it here.
    // In our current architecture, the SSE stream does not return chunks token-by-token.
    // To get the chunks to display in the RightPanel, we actually need to hit /api/query normally,
    // OR the backend needs to send chunks in the 'done' SSE event.
    // Since the backend doesn't send chunks in 'done' right now (only query_type, latency_ms, impact_edges),
    // we'll just leave chunks empty for streamed RAG responses, or rely on a separate /api/search call if we really want them.
    // For now, if chunks are passed, we set them.
    if (chunks && chunks.length > 0) {
      setLastChunks(chunks);
    }
  }, []);

  // When a query is selected from command palette
  const showRightPanel = isMobile ? mobileRightOpen : true;
  const showLeftPanel  = isMobile ? mobileLeftOpen  : true;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-[var(--text-primary)]" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient blobs for depth */}
      <div className="ambient-blob w-[600px] h-[600px] top-[-200px] left-[-200px]" style={{ background: 'var(--accent-dim)' }} />
      <div className="ambient-blob w-[500px] h-[500px] bottom-[-200px] right-[-100px]" style={{ background: 'rgba(56,189,248,0.06)' }} />

      <TopBar 
        theme={theme} 
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
        onCommandOpen={() => setCmdOpen(true)}
        healthStatus={health}
      />

      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: 'var(--topbar-h)' }}>
        
        {/* Left Sidebar */}
        {showLeftPanel && (
          <div className={isMobile ? "fixed inset-0 z-30 bg-black/50" : ""}>
            <div className={isMobile ? "absolute left-0 top-0 bottom-0 w-[280px] shadow-2xl" : "h-full shrink-0"}>
              <Sidebar 
                healthStatus={health} 
                isMobile={isMobile} 
                onClose={() => setMobileLeftOpen(false)} 
              />
            </div>
            {isMobile && <div className="absolute inset-0 z-[-1]" onClick={() => setMobileLeftOpen(false)} />}
          </div>
        )}

        {/* Center Chat */}
        <main className="flex-1 min-w-0 relative h-full">
          {/* Mobile panel toggles */}
          {isMobile && (
            <div className="absolute top-2 left-2 z-10 flex gap-2">
              <button onClick={() => setMobileLeftOpen(true)} className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-base)] shadow">Menu</button>
              <button onClick={() => setMobileRightOpen(true)} className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-base)] shadow">Details</button>
            </div>
          )}
          <ChatPanel 
            streamHook={streamHook} 
            onAnswer={handleAnswer} 
          />
        </main>

        {/* Right Details Panel */}
        {showRightPanel && (
          <div className={isMobile ? "fixed inset-0 z-30 bg-black/50" : "h-full shrink-0"}>
            <div className={isMobile ? "absolute right-0 top-0 bottom-0 w-[320px] shadow-2xl" : "h-full shrink-0"}>
              <RightPanel 
                chunks={lastChunks} 
                queryType={queryType} 
                impactEdges={impactEdges}
                isMobile={isMobile}
                onClose={() => setMobileRightOpen(false)}
              />
            </div>
            {isMobile && <div className="absolute inset-0 z-[-1]" onClick={() => setMobileRightOpen(false)} />}
          </div>
        )}
      </div>

      <CommandPalette 
        isOpen={cmdOpen} 
        onClose={() => setCmdOpen(false)}
        onThemeSelect={setTheme}
        onSelectQuery={(q) => {
           // We set the input value in ChatPanel using the custom event hack we planned,
           // or we can just pass this down. Custom event is easiest without refactoring ChatPanel.
           const input = document.getElementById('main-query-input');
           if (input) {
             const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
             nativeInputValueSetter.call(input, q);
             input.dispatchEvent(new Event('change', { bubbles: true }));
             setTimeout(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })), 50);
           }
        }}
      />
    </div>
  );
}