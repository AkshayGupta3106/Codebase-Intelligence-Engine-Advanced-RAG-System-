import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import QueryInput from "./components/QueryInput";
import AnswerPanel from "./components/AnswerPanel";

const HISTORY_KEY = "rag_query_history_v1";
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "";

function App() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [queryHistory, setQueryHistory] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [indexingRepo, setIndexingRepo] = useState(false);
  const [repoStatus, setRepoStatus] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  
  // New premium states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  const answerRef = useRef(null);

  // Health check on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/health`);
        setHealthStatus(res.data);
      } catch {
        setHealthStatus(null);
      }
    };
    checkHealth();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;

      const normalized = parsed
        .filter(
          (item) =>
            item &&
            typeof item.query === "string" &&
            typeof item.answer === "string"
        )
        .slice(0, 5);

      setQueryHistory(normalized);
    } catch (error) {
      console.error("Failed to load query history", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(queryHistory.slice(0, 5)));
  }, [queryHistory]);

  useEffect(() => {
    if (response && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [response]);

  // Toast System
  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Keyboard shortcut (⌘K or Ctrl+K to focus search bar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("search-query-input");
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);



  const copyToClipboard = async (text, key) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      addToast("Copied to clipboard!", "success");
      setTimeout(() => setCopiedKey(""), 1400);
    } catch (err) {
      console.error("Copy failed", err);
      addToast("Failed to copy text", "error");
    }
  };

  const handleFileSelection = (file) => {
    if (!file) return;

    const allowedExtensions = [".py", ".go", ".js", ".ts"];
    const lowerName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isAllowed) {
      setUploadStatus("Please select a .py, .go, .js, or .ts file.");
      addToast("Invalid file type uploaded.", "error");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadStatus("");
    addToast(`Selected file: ${file.name}`, "info");
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;

    try {
      setUploading(true);
      setUploadStatus("");
      setErrorMessage("");

      const formData = new FormData();
      formData.append("file", selectedFile);

      await axios.post(`${API_BASE_URL}/api/ingest`, formData);
      setUploadStatus("File uploaded successfully.");
      addToast(`Successfully ingested ${selectedFile.name}!`, "success");
    } catch (err) {
      console.error(err);
      setUploadStatus("Upload failed. Please try again.");
      addToast("Failed to ingest file.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setLoading(true);
    setErrorMessage("");
    setIsStreaming(false);
    setResponse(null);

    // Try streaming endpoint first (Gemini token-by-token)
    try {
      let accumulatedText = "";
      let finalQueryType = null;
      let finalLatencyMs = null;
      let streamedAny = false;

      const res = await fetch(`${API_BASE_URL}/api/query/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery, top_k: 5 }),
      });

      if (!res.ok) throw new Error(`SSE endpoint returned ${res.status}`);

      setIsStreaming(true);
      setLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "token") {
              accumulatedText += evt.data;
              streamedAny = true;
              setResponse((prev) => ({
                ...(prev || {}),
                answer: accumulatedText,
                retrieved_chunks: prev?.retrieved_chunks || [],
              }));
            } else if (evt.type === "done") {
              finalQueryType = evt.query_type;
              finalLatencyMs = evt.latency_ms;
            } else if (evt.type === "error") {
              throw new Error(evt.data);
            }
          } catch {}
        }
      }

      setIsStreaming(false);
      setResponse((prev) => ({
        ...(prev || {}),
        query_type: finalQueryType,
        latency_ms: finalLatencyMs,
      }));

      if (streamedAny) {
        setQueryHistory((prev) => {
          const nextItem = { query: trimmedQuery, answer: accumulatedText };
          const deduped = prev.filter((item) => item.query !== trimmedQuery);
          return [nextItem, ...deduped].slice(0, 5);
        });
        return;
      }
    } catch (streamErr) {
      console.warn("Streaming failed, falling back to /api/query:", streamErr);
      setIsStreaming(false);
    }

    // Fallback: standard /api/query
    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE_URL}/api/query`, {
        query: trimmedQuery,
        top_k: 5,
      });

      setResponse(res.data);
      setQueryHistory((prev) => {
        const nextItem = {
          query: trimmedQuery,
          answer: String(res?.data?.answer || ""),
        };
        const deduped = prev.filter((item) => item.query !== trimmedQuery);
        return [nextItem, ...deduped].slice(0, 5);
      });
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err?.response?.data?.detail ||
          "Unable to process your request right now. Please try again."
      );
      addToast("Failed to fetch query response", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleIndexRepo = async () => {
    const trimmedRepoUrl = repoUrl.trim();

    if (!trimmedRepoUrl || indexingRepo) return;

    if (!/^https?:\/\//i.test(trimmedRepoUrl)) {
      setRepoStatus("Please enter a valid repository URL starting with http or https.");
      addToast("Invalid repository URL format.", "error");
      return;
    }

    try {
      setIndexingRepo(true);
      setRepoStatus("");
      addToast("Starting repository indexing...", "info");

      await axios.post(`${API_BASE_URL}/api/index_repo`, {
        repo_url: trimmedRepoUrl,
      });

      setRepoStatus("Repository indexed successfully.");
      addToast("Repository indexed successfully!", "success");
    } catch (err) {
      console.error(err);
      setRepoStatus("Failed to index repository. Please try again.");
      addToast("Repository indexing failed.", "error");
    } finally {
      setIndexingRepo(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative min-h-screen overflow-x-clip bg-transparent px-6 pt-20 pb-4 text-[#e2e8f0] md:px-12 lg:px-24 flex flex-col justify-between"
    >
      
      {/* Toast Notification Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              className="pointer-events-auto flex items-center gap-3 rounded-md border border-[#3c3c3c] bg-[#252526] px-4 py-3.5 shadow-2xl min-w-[280px] max-w-[400px]"
            >
              {toast.type === "success" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              )}
              {toast.type === "error" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
              )}
              {toast.type === "info" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </div>
              )}
              <p className="text-xs font-semibold tracking-wide text-slate-200">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Slide-out Query History Drawer */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 z-40 bg-black backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 z-50 h-full w-full max-w-md border-l border-white/5 glass-panel p-6 shadow-2xl flex flex-col"
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-300 font-['Outfit']">
                    Query History
                  </h2>
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="rounded-xl border border-white/5 p-2 hover:bg-white/5 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                {queryHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/10 py-16 text-center">
                    <p className="text-sm font-medium text-slate-400">No recent queries</p>
                    <p className="text-xs text-slate-500 mt-2">Start asking to build history.</p>
                  </div>
                ) : (
                  queryHistory.map((item, index) => (
                    <motion.button
                      key={`${item.query}-${index}`}
                      whileHover={{ scale: 1.01, x: 2 }}
                      onClick={() => {
                        setQuery(item.query);
                        setResponse({ answer: item.answer });
                        setIsHistoryOpen(false);
                      }}
                      className="group relative w-full overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-800/20 p-4 text-left transition-all hover:border-slate-600/50 hover:bg-slate-800/40"
                    >
                      <p className="truncate text-sm font-semibold text-slate-300 group-hover:text-blue-300 transition-colors">
                        {item.query}
                      </p>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500 font-['Space_Grotesk']">
                        {item.answer}
                      </p>
                    </motion.button>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* TOP NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-30 border-b border-white/5 glass-panel px-6 py-3 md:px-12 lg:px-24">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-200 font-['Space_Grotesk']">
              Codebase <span className="text-emerald-400">Intelligence Engine</span>
            </span>
          </div>

          {/* Status badge */}
          <div className="hidden sm:inline-flex items-center gap-2 rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2 py-1 text-[11px] font-mono-ide text-[#9cdcfe]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            CONNECTED
            <span className="text-slate-600">•</span>
            {healthStatus ? (
              <span className="flex items-center gap-1.5 text-[10px]">
                {/* LLM provider */}
                <span className="text-slate-300 font-bold">
                  ⚡ {healthStatus.gemini_configured ? "Gemini" : healthStatus.groq_configured ? "Groq" : "Local"}
                </span>
                <span className="text-slate-700">|</span>
                {/* Qdrant */}
                <span className={healthStatus.qdrant ? "text-emerald-400" : "text-rose-400"}>
                  Qdrant {healthStatus.qdrant ? "✓" : "✗"}
                </span>
                <span className="text-slate-700">|</span>
                {/* PostgreSQL */}
                <span className={healthStatus.postgres ? "text-emerald-400" : "text-rose-400"}>
                  SQL {healthStatus.postgres ? "✓" : "✗"}
                </span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">checking…</span>
            )}
          </div>

          {/* Navigation Links & Action */}
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
              <a href="https://github.com/Prateek-1110/Rag_Codebase" target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors">GitHub</a>
              <button onClick={() => setIsAboutOpen(true)} className="hover:text-blue-400 transition-colors cursor-pointer outline-none">About</button>
            </div>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="group flex items-center gap-2 rounded border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-1.5 text-xs font-mono-ide text-[#d4d4d4] transition-all hover:bg-[#3c3c3c] hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              History
              {queryHistory.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-[10px] text-blue-400 font-bold border border-blue-500/30">
                  {queryHistory.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Dynamic Background Mesh */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, 30, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-600/15 blur-[120px]" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -60, 0],
          y: [0, -40, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute -bottom-40 -right-20 h-[700px] w-[700px] rounded-full bg-sky-600/10 blur-[120px]" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.3, 0.15],
          x: [0, 40, 0],
          y: [0, -50, 0]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute right-[20%] top-[30%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" 
      />

      {/* Subtle Dark Neon Background */}
      <motion.div 
        animate={{ 
          scale: [1, 1.05, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-emerald-600/20 blur-[120px] mix-blend-screen" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute right-[10%] bottom-[10%] h-[600px] w-[600px] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen" 
      />

      {/* IDE Editor Layout */}
      <main className="mx-auto mt-6 flex w-full max-w-[1400px] flex-1 flex-col gap-6 lg:flex-row pb-12 z-10 px-4">

        {/* Left Sidebar (Database Explorer / Tools) */}
        <aside className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-6">
          
          {/* Card 1: Index GitHub Repository */}
          <section
            className="flex flex-col gap-4 rounded-xl border border-white/5 glass-panel p-5"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                <h2 className="text-[11px] font-mono-ide uppercase tracking-wider">
                  Index Repository
                </h2>
              </div>
            </div>
            
            <p className="text-xs text-slate-400 font-mono-ide leading-relaxed">
              Index a GitHub repository to map call graphs.
            </p>
            
            <div className="relative group">
              <input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/..."
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-xs font-mono-ide text-slate-200 outline-none transition focus:border-emerald-500/50 focus:bg-black/60 placeholder:text-slate-500 shadow-inner"
              />
            </div>

            <motion.button
              whileHover={{ scale: indexingRepo || !repoUrl.trim() ? 1 : 1.02 }}
              whileTap={{ scale: indexingRepo || !repoUrl.trim() ? 1 : 0.98 }}
              onClick={handleIndexRepo}
              disabled={indexingRepo || !repoUrl.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-[11px] font-bold font-mono-ide tracking-widest uppercase text-white transition-all disabled:opacity-50 hover:shadow-[0_0_15px_rgba(52,211,153,0.4)]"
            >
              {indexingRepo ? (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Indexing...
                </>
              ) : "Run Indexer"}
            </motion.button>

            <span className="text-[10px] text-[#858585] font-mono-ide">* Max 20 files / 20KB each.</span>
            
            {repoStatus && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border border-white/5 bg-black/20 p-3 text-center text-xs font-medium ${repoStatus.toLowerCase().includes("success") ? "text-emerald-400" : "text-rose-400"}`}>
                {repoStatus}
              </motion.div>
            )}
          </section>

          {/* Card 2: File Ingestion */}
          <section
            className="flex flex-col gap-4 rounded-xl border border-white/5 glass-panel p-5"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>
                <h2 className="text-[11px] font-mono-ide uppercase tracking-wider">
                  Ingest SQL/dbt File
                </h2>
              </div>
            </div>

            <div
              className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-all duration-300 ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                  : selectedFile
                  ? "border-white/20 bg-white/5"
                  : "border-white/10 hover:border-indigo-500/50 hover:bg-white/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileSelection(e.dataTransfer.files[0]);
              }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-slate-300 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold font-mono-ide text-slate-200">
                  {selectedFile ? selectedFile.name : "Drag & Drop SQL/dbt file"}
                </p>
                {!selectedFile && (
                  <p className="mt-1 text-[10px] text-slate-500 font-mono-ide">
                    .sql, .yml supported
                  </p>
                )}
              </div>
              <label className="mt-2 cursor-pointer rounded-lg bg-white/10 px-4 py-1.5 text-[10px] font-bold font-mono-ide text-white hover:bg-white/20 transition-all border border-white/5">
                Browse Files
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileSelection(e.target.files[0])}
                  accept=".sql,.yml,.yaml"
                />
              </label>
            </div>

            <motion.button
              whileHover={{ scale: uploading || !selectedFile ? 1 : 1.02 }}
              whileTap={{ scale: uploading || !selectedFile ? 1 : 0.98 }}
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-[11px] font-bold font-mono-ide tracking-widest uppercase text-white transition-all disabled:opacity-50 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)]"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Uploading...
                </>
              ) : "Execute Ingestion"}
            </motion.button>

            {uploadStatus && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center text-xs font-medium ${uploadStatus.toLowerCase().includes("success") ? "text-emerald-400" : "text-rose-400"}`}>
                {uploadStatus}
              </motion.p>
            )}
          </section>
        </aside>

        {/* Main Editor Workspace (Query & Results) */}
        <div className="flex-1 flex flex-col min-w-0 pb-12 gap-6">
          <section className="flex flex-col w-full">
            <QueryInput query={query} setQuery={setQuery} onSubmit={handleSubmit} loading={loading} />
          </section>

          {/* Clickable Suggestion Chips */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-2.5 text-xs text-slate-400 px-4"
          >
            <span className="font-semibold text-slate-500">Try asking:</span>
            <button
              onClick={() => setQuery("Explain the main api routes.")}
              className="px-3.5 py-1.5 rounded-full border border-white/5 bg-white/5 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-300 transition-all font-medium active:scale-95"
            >
              "Explain the main api routes."
            </button>
            <button
              onClick={() => setQuery("Show call flow of index_repo.")}
              className="px-3.5 py-1.5 rounded-full border border-white/5 bg-white/5 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-300 transition-all font-medium active:scale-95"
            >
              "Show call flow of index_repo."
            </button>
            <button
              onClick={() => setQuery("Where are embeddings generated?")}
              className="px-3.5 py-1.5 rounded-full border border-white/5 bg-white/5 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-300 transition-all font-medium active:scale-95"
            >
              "Where are embeddings generated?"
            </button>
          </motion.div>
          {errorMessage && (
            <div className="border border-[#f14c4c] bg-[#1e1e1e] rounded p-4 mb-8 flex flex-col gap-2 shadow-lg">
              <div className="flex items-center gap-2 text-[#f14c4c]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-xs font-mono-ide uppercase tracking-wider font-bold">Execution Error</span>
              </div>
              <div className="text-xs text-[#d4d4d4] font-mono-ide">
                {errorMessage}
              </div>
            </div>
          )}

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel relative overflow-hidden rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-8"
            >
              <div className="absolute left-0 top-0 h-1 w-full bg-slate-800">
                 <motion.div 
                   initial={{ x: "-100%" }}
                   animate={{ x: "100%" }}
                   transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                   className="h-full w-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent" 
                 />
              </div>
              <div className="flex items-center gap-5 mb-8">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-20 duration-1000"></span>
                  <svg className="animate-spin h-7 w-7 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white">Synthesizing Context</h3>
                  <p className="text-sm text-slate-400 mt-1">Analyzing vector embeddings...</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 w-1/3 rounded-lg bg-slate-800 animate-pulse" />
                <div className="h-4 w-full rounded-lg bg-slate-800 animate-pulse delay-75" />
                <div className="h-4 w-11/12 rounded-lg bg-slate-800 animate-pulse delay-100" />
                <div className="h-4 w-4/5 rounded-lg bg-slate-800 animate-pulse delay-150" />
              </div>
            </motion.div>
          )}

          {(response && !loading) && (
            <div ref={answerRef} className="pb-24">
              <AnswerPanel
                response={response}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
                isStreaming={isStreaming}
              />
            </div>
          )}
        </div>

      {/* About Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAboutOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 m-auto max-h-[520px] w-[90%] max-w-xl overflow-hidden rounded-3xl border border-blue-500/25 bg-[#020617]/95 p-6 shadow-[0_0_50px_rgba(59,130,246,0.3)] backdrop-blur-2xl flex flex-col justify-between"
            >
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-sky-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white font-['Outfit']">
                      About RepoAtlas
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsAboutOpen(false)}
                    className="rounded-xl border border-white/10 p-2 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div className="space-y-4 text-sm leading-relaxed text-slate-350 font-sans">
                  <p>
                    <strong>RepoAtlas</strong> is an AI-driven codebase reasoning engine built to parse, structure, and understand complex software systems deterministically.
                  </p>
                  
                  <div className="space-y-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 p-4">
                    <div className="flex gap-3">
                      <span className="text-blue-400 mt-1 shrink-0">•</span>
                      <p className="text-xs text-slate-200">
                        Designed hybrid retrieval fusing semantic search (Qdrant) with BM25 via Reciprocal Rank Fusion and Cross-Encoder reranking (<code className="font-mono text-blue-300 bg-blue-500/10 px-1 rounded">ms-marco-MiniLM</code>), achieving <strong>92% File Hit Rate@3</strong>.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-blue-400 mt-1 shrink-0">•</span>
                      <p className="text-xs text-slate-200">
                        Implemented an LLM intent classifier routing across four query types; <code className="font-mono text-blue-300 bg-blue-500/10 px-1 rounded">flow</code> / <code className="font-mono text-blue-300 bg-blue-500/10 px-1 rounded">find_usage</code> bypass vector search and traverse a PostgreSQL call graph for deterministic dependency resolution.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-blue-400 mt-1 shrink-0">•</span>
                      <p className="text-xs text-slate-200">
                        Deployed Groq with Ollama local fallback, validated via a custom RAG assessment harness (<strong>Faithfulness: 0.91, Answer Relevancy: 0.88, Latency p95: ~1.2s</strong>).
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    To learn more about configuration, pipelines, and evaluation metrics, read the repository <a href="https://github.com/Prateek-1110/Rag_Codebase/blob/master/README.md" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-0.5">README.md<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsAboutOpen(false)}
                  className="rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-bold px-6 py-2.5 text-xs tracking-wider transition-all"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      </main>
    </motion.div>
  );
}

export default App;