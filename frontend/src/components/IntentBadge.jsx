/**
 * src/components/IntentBadge.jsx
 * Colored badge showing which engine answered (retrieval vs graph).
 */
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Search, BookOpen, Users, Zap, GitBranch } from 'lucide-react';

const INTENTS = {
  explain: {
    label: 'Explain',
    icon: <BookOpen size={10} />,
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.30)',
    color: '#fbbf24',
  },
  search: {
    label: 'Search',
    icon: <Search size={10} />,
    bg: 'rgba(56,189,248,0.12)',
    border: 'rgba(56,189,248,0.30)',
    color: '#38bdf8',
  },
  find_usage: {
    label: 'Find Usage',
    icon: <Users size={10} />,
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.30)',
    color: '#a78bfa',
  },
  impact_analysis: {
    label: 'Impact',
    icon: <Zap size={10} />,
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.30)',
    color: '#34d399',
  },
  flow: {
    label: 'Flow',
    icon: <GitBranch size={10} />,
    bg: 'rgba(129,140,248,0.12)',
    border: 'rgba(129,140,248,0.30)',
    color: '#818cf8',
  },
};

export default function IntentBadge({ queryType }) {
  if (!queryType) return null;
  const cfg = INTENTS[queryType] ?? {
    label: queryType,
    icon: null,
    bg: 'var(--bg-elevated)',
    border: 'var(--border-base)',
    color: 'var(--text-secondary)',
  };

  return (
    <motion.span
      key={queryType}
      initial={{ opacity: 0, scale: 0.82, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold font-mono uppercase tracking-widest"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      {cfg.icon}
      {cfg.label}
    </motion.span>
  );
}
