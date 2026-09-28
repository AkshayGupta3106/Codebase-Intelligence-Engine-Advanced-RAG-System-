/**
 * src/components/CommandPalette.jsx
 * macOS Spotlight-style command palette for quick actions.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Search, Command, BookOpen, Users, GitBranch, Moon, Sun, Monitor } from 'lucide-react';

const SUGGESTIONS = [
  { id: 'q1', icon: <BookOpen size={14} />, label: 'Explain RAG pipeline', type: 'query' },
  { id: 'q2', icon: <Users size={14} />, label: 'Find usages of run_rag_pipeline()', type: 'query' },
  { id: 'q3', icon: <GitBranch size={14} />, label: 'What breaks if I change generate_embeddings?', type: 'query' },
  { id: 't1', icon: <Moon size={14} />, label: 'Switch to Dark Theme', type: 'action', action: 'theme-dark' },
  { id: 't2', icon: <Sun size={14} />, label: 'Switch to Light Theme', type: 'action', action: 'theme-light' },
];

export default function CommandPalette({ isOpen, onClose, onSelectQuery, onThemeSelect }) {
  const [input, setInput] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  // Filter items
  const items = SUGGESTIONS.filter(item => 
    item.label.toLowerCase().includes(input.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (item) => {
    if (item.type === 'query') {
      onSelectQuery(item.label);
    } else if (item.type === 'action') {
      if (item.action === 'theme-dark') onThemeSelect('dark');
      if (item.action === 'theme-light') onThemeSelect('light');
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[activeIndex]) handleSelect(items[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-xl rounded-2xl overflow-hidden glass"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px var(--border-strong)' }}
          >
            <div className="flex items-center px-4 py-3" style={{ borderBottom: '1px solid var(--border-base)' }}>
              <Search size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setActiveIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search commands or ask a question..."
                className="w-full bg-transparent px-3 py-1 text-sm outline-none placeholder:italic"
                style={{ color: 'var(--text-primary)' }}
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-base)' }}>
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2" role="listbox">
              {items.length === 0 ? (
                <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No results found. Press Enter to search codebase for "{input}".
                </div>
              ) : (
                items.map((item, i) => {
                  const active = i === activeIndex;
                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => handleSelect(item)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                      style={{
                        background: active ? 'var(--accent)' : 'transparent',
                        color: active ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      <span style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="ml-auto text-[10px] font-mono uppercase tracking-widest opacity-60">
                        {item.type}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="flex items-center justify-between px-4 py-2 text-[10px] font-mono uppercase tracking-widest" style={{ borderTop: '1px solid var(--border-base)', background: 'var(--bg-elevated)', color: 'var(--text-xmuted)' }}>
              <span>Use arrows to navigate</span>
              <span className="flex items-center gap-1"><Command size={10} />K to open</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
