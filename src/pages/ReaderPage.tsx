import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Maximize, Minimize, ChevronLeft, ChevronRight,
  BookOpen, ZoomIn, ZoomOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ePub, { Rendition } from "epubjs";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Use the local worker bundled with pdfjs-dist (version-safe, works offline)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const USER_ID = "default";
const AUTOSAVE_INTERVAL_MS = 30_000; // Save progress every 30 s

// ─── Loading Screen ──────────────────────────────────────────────────────────

const LOAD_STAGES = [
  { label: "Buch wird geöffnet…",       pct: 20 },
  { label: "Seiten werden vorbereitet…", pct: 55 },
  { label: "Leseposition wird geladen…", pct: 80 },
  { label: "Bereit!",                    pct: 100 },
];

function LoadingScreen({ fileType }: { fileType: "pdf" | "epub" | "other" }) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    LOAD_STAGES.forEach((_, i) => {
      if (i === 0) return;
      timers.push(setTimeout(() => setStageIdx(i), i * 900));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const stage = LOAD_STAGES[stageIdx];

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.4 } }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 gap-10 select-none"
    >
      {/* Animated book icon */}
      <div className="relative flex items-center justify-center">
        {/* Glow ring */}
        <motion.div
          className="absolute w-32 h-32 rounded-full bg-emerald-500/20"
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Icon container */}
        <motion.div
          className="relative w-24 h-24 bg-zinc-800 rounded-3xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <BookOpen size={44} className="text-emerald-400" />

          {/* File type badge */}
          <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shadow">
            {fileType}
          </div>
        </motion.div>
      </div>

      {/* Stage label */}
      <div className="flex flex-col items-center gap-4 w-72">
        <AnimatePresence mode="wait">
          <motion.p
            key={stageIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-medium text-zinc-300 tracking-wide text-center"
          >
            {stage.label}
          </motion.p>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
            animate={{ width: `${stage.pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>

        <span className="text-xs text-zinc-600 font-mono">{stage.pct}%</span>
      </div>

      {/* Dots */}
      <div className="flex gap-2">
        {LOAD_STAGES.map((_, i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            animate={{
              backgroundColor: i <= stageIdx ? "#10b981" : "#27272a",
              scale: i === stageIdx ? 1.4 : 1,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReaderPage() {
  const { filename } = useParams();
  const navigate = useNavigate();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // PDF state
  const [pdfDoc, setPdfDoc]   = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale]     = useState(1.7);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // EPUB state
  const [rendition, setRendition]       = useState<Rendition | null>(null);
  const [epubProgress, setEpubProgress] = useState<{ current: number; total: number } | null>(null);
  const [theme, setTheme]   = useState<"default" | "sepia" | "dark">("default");
  const [fontSize, setFontSize] = useState(170);
  const epubContainerRef = useRef<HTMLDivElement>(null);
  const epubCfiRef = useRef<string | undefined>(undefined); // latest CFI for saving

  // Timing / progress helpers
  const containerRef    = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const pagesReadRef    = useRef<number>(0);      // page-changes while reading
  const savedPageRef    = useRef<number>(1);
  // Tracks the active PDF render task so we can cancel it before starting a new one
  const renderTaskRef   = useRef<pdfjsLib.RenderTask | null>(null);

  const fileUrl = `/api/books/content/${filename}`;
  const isPdf  = filename?.toLowerCase().endsWith(".pdf");
  const isEpub = filename?.toLowerCase().endsWith(".epub");
  const fileType: "pdf" | "epub" | "other" = isPdf ? "pdf" : isEpub ? "epub" : "other";

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ── Progress helpers ──────────────────────────────────────────────────────
  const saveProgressToBackend = useCallback(async (opts: {
    position: string;
    progressPercent: number;
    completed?: boolean;
    timeSpentExtra?: number;
  }) => {
    if (!filename) return;
    try {
      await fetch(`/api/progress/by-filename/${filename}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          position:         opts.position,
          progress_percent: opts.progressPercent,
          completed:        opts.completed ?? false,
          time_spent_seconds: opts.timeSpentExtra ?? 0,
        }),
      });
    } catch (err) {
      console.warn("Progress save failed:", err);
    }
  }, [filename]);

  const logSessionToBackend = useCallback(async () => {
    if (!filename) return;
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
    if (duration < 5) return; // ignore very short visits
    try {
      await fetch(`/api/session/by-filename/${filename}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id:          USER_ID,
          duration_seconds: duration,
          pages_read:       pagesReadRef.current,
        }),
      });
    } catch (_) { /* best-effort */ }
  }, [filename]);

  // ── Load saved progress on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!filename) return;
    (async () => {
      try {
        const res = await fetch(`/api/progress/by-filename/${filename}?user_id=${USER_ID}`);
        if (res.ok) {
          const p = await res.json();
          if (p?.position) {
            if (isPdf) {
              const page = parseInt(p.position, 10);
              if (!isNaN(page) && page > 1) {
                setPageNum(page);
                savedPageRef.current = page;
              }
            } else if (isEpub) {
              // CFI is used when displaying the epub (passed below)
              epubCfiRef.current = p.position;
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load progress:", err);
      }
    })();
  }, [filename]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save session log on page unload ──────────────────────────────────────
  useEffect(() => {
    const handleUnload = () => { void logSessionToBackend(); };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      void logSessionToBackend(); // also save when component unmounts (navigate away)
    };
  }, [logSessionToBackend]);

  // ═══ PDF Logic ════════════════════════════════════════════════════════════

  const themes = {
    default: { body: { background: "#ffffff !important", color: "#000000 !important" } },
    sepia:   { body: { background: "#f4ecd8 !important", color: "#5b4636 !important" } },
    dark:    { body: { background: "#18181b !important", color: "#d4d4d8 !important" } },
  };

  const renderPage = useCallback(async (num: number, doc: pdfjsLib.PDFDocumentProxy) => {
    if (!canvasRef.current) return;

    // Cancel any in-progress render to avoid the "same canvas" error
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const page     = await doc.getPage(num);
      const viewport = page.getViewport({ scale });
      const canvas   = canvasRef.current;
      const context  = canvas.getContext("2d");
      if (!context) return;
      canvas.height = viewport.height;
      canvas.width  = viewport.width;

      const task = page.render({ canvasContext: context, canvas, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      // Silently ignore cancellation; log everything else
      if (err?.name !== "RenderingCancelledException") {
        console.error("Error rendering PDF page:", err);
      }
    }
  }, [scale]);

  useEffect(() => {
    if (!isPdf || !filename) return;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const doc = await pdfjsLib.getDocument(fileUrl).promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        // Small delay so the loading animation can finish gracefully
        await new Promise(r => setTimeout(r, 400));
        setIsLoading(false);
        renderPage(savedPageRef.current, doc);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("PDF konnte nicht geladen werden.");
        setIsLoading(false);
      }
    })();
  }, [isPdf, filename, fileUrl, renderPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pdfDoc) renderPage(pageNum, pdfDoc);
  }, [pageNum, pdfDoc, renderPage]);

  // Auto-save PDF progress at interval
  useEffect(() => {
    if (!isPdf || !pdfDoc) return;
    const id = setInterval(() => {
      const pct = numPages > 0 ? Math.round((pageNum / numPages) * 100) : 0;
      void saveProgressToBackend({
        position:        String(pageNum),
        progressPercent: pct,
        completed:       pageNum >= numPages,
      });
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPdf, pdfDoc, pageNum, numPages, saveProgressToBackend]);

  // ═══ EPUB Logic ═══════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isEpub || !filename || !epubContainerRef.current) return;

    const book = ePub(fileUrl);
    const rend = book.renderTo(epubContainerRef.current, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      manager: "default",
    });

    // Prefer backend CFI, fall back to localStorage
    const savedCfi =
      epubCfiRef.current ||
      localStorage.getItem(`reading_progress_epub_${filename}`) ||
      undefined;

    rend.display(savedCfi).then(() => {
      setIsLoading(false);
      rend.themes.register("default", themes.default);
      rend.themes.register("sepia",   themes.sepia);
      rend.themes.register("dark",    themes.dark);
      rend.themes.select(theme);
    }).catch(err => {
      console.error("Error displaying EPUB:", err);
      setError("EPUB konnte nicht geladen werden.");
      setIsLoading(false);
    });

    rend.on("relocated", (location: any) => {
      const cfi = location?.start?.cfi;
      if (!cfi || !filename) return;

      epubCfiRef.current = cfi;
      // Keep localStorage as backup
      localStorage.setItem(`reading_progress_epub_${filename}`, cfi);

      if (location.start.displayed) {
        const { page, total } = location.start.displayed;
        setEpubProgress({ current: page, total });
        pagesReadRef.current += 1;

        const pct = total > 0 ? Math.round((page / total) * 100) : 0;
        // Save to backend on every relocation
        void saveProgressToBackend({
          position:        cfi,
          progressPercent: pct,
          completed:       page >= total,
        });
      }
    });

    setRendition(rend);

    const handleResize = () => {
      if (epubContainerRef.current) {
        rend.resize(epubContainerRef.current.clientWidth, epubContainerRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      book.destroy();
    };
  }, [isEpub, filename, fileUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rendition) {
      rendition.themes.select(theme);
      rendition.themes.fontSize(`${fontSize}%`);
    }
  }, [theme, fontSize, rendition]);

  // ═══ Navigation ═══════════════════════════════════════════════════════════

  const handlePrev = () => {
    if (isPdf && pageNum > 1) {
      setPageNum(p => {
        const n = p - 1;
        const pct = numPages > 0 ? Math.round((n / numPages) * 100) : 0;
        void saveProgressToBackend({ position: String(n), progressPercent: pct });
        return n;
      });
    } else if (isEpub && rendition) {
      rendition.prev();
    }
  };

  const handleNext = () => {
    if (isPdf && pageNum < numPages) {
      setPageNum(p => {
        const n = p + 1;
        pagesReadRef.current += 1;
        const pct = numPages > 0 ? Math.round((n / numPages) * 100) : 0;
        void saveProgressToBackend({ position: String(n), progressPercent: pct, completed: n >= numPages });
        return n;
      });
    } else if (isEpub && rendition) {
      rendition.next();
    }
  };

  // ═══ Render ════════════════════════════════════════════════════════════════

  return (
    <div ref={containerRef} className="fixed inset-0 bg-zinc-950 flex flex-col z-[100] font-sans">

      {/* ── Header ── */}
      <div className="bg-zinc-900/90 backdrop-blur-md px-6 py-3 flex items-center justify-between text-white border-b border-white/5 shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-white/10 rounded-full transition-all hover:scale-110 active:scale-95"
            title="Zurück"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-6 w-px bg-white/10 mx-1" />
          <h1 className="text-sm font-medium tracking-wide text-zinc-400 truncate max-w-[150px] sm:max-w-md">
            {filename}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
            title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div
        className={`flex-1 overflow-auto flex items-center justify-center relative transition-colors duration-300 ${
          isEpub && theme === "dark"  ? "bg-zinc-950" :
          isEpub && theme === "sepia" ? "bg-[#e8dfc8]" : "bg-zinc-900"
        }`}
      >
        <AnimatePresence>
          {isLoading && <LoadingScreen fileType={fileType} />}
        </AnimatePresence>

        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4 p-8 bg-zinc-800 rounded-3xl border border-red-500/20 max-w-sm z-50"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
              <BookOpen size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">Hoppla!</h3>
            <p className="text-zinc-400 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-zinc-700 text-white rounded-xl hover:bg-zinc-600 transition-colors"
            >
              Erneut versuchen
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full flex items-center justify-center p-4 sm:p-8"
          >
            <div className="w-full max-w-5xl h-full bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden flex items-center justify-center relative">
              {isPdf ? (
                <div className="w-full h-full overflow-auto flex justify-center bg-zinc-200">
                  <canvas ref={canvasRef} className="shadow-2xl my-4" />
                </div>
              ) : isEpub ? (
                <div ref={epubContainerRef} className="w-full h-full epub-viewer" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                  <img src={fileUrl} alt="Book Content" className="max-w-full max-h-full object-contain shadow-lg" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Footer Controls ── */}
      <div className="bg-zinc-900/95 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-6 text-white border-t border-white/5">
        {/* Left: Display settings */}
        <div className="flex items-center gap-4 order-2 sm:order-1">
          {isEpub && (
            <>
              {/* Font size */}
              <div className="flex items-center bg-zinc-800 rounded-lg p-1">
                <button onClick={() => setFontSize(s => Math.max(50, s - 10))} className="p-1.5 hover:bg-white/10 rounded-md transition-colors" title="Schrift verkleinern">
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono w-10 text-center opacity-60">{fontSize}%</span>
                <button onClick={() => setFontSize(s => Math.min(200, s + 10))} className="p-1.5 hover:bg-white/10 rounded-md transition-colors" title="Schrift vergrößern">
                  <ZoomIn size={16} />
                </button>
              </div>
              {/* Theme picker */}
              <div className="flex items-center bg-zinc-800 rounded-lg p-1">
                {(["default", "sepia", "dark"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`w-6 h-6 rounded-md border border-white/10 m-0.5 transition-all ${theme === t ? "ring-2 ring-emerald-500 scale-110" : "hover:scale-105"}`}
                    style={{ background: t === "default" ? "#ffffff" : t === "sepia" ? "#f4ecd8" : "#18181b" }}
                    title={t === "default" ? "Hell" : t === "sepia" ? "Sepia" : "Dunkel"}
                  />
                ))}
              </div>
            </>
          )}

          {isPdf && (
            <div className="flex items-center bg-zinc-800 rounded-lg p-1">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-mono w-12 text-center opacity-60">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                <ZoomIn size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Center: Navigation */}
        <div className="flex items-center gap-8 order-1 sm:order-2">
          <button
            onClick={handlePrev}
            disabled={isLoading || (isPdf && pageNum <= 1)}
            className="p-3 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-full transition-all disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white group"
          >
            <ChevronLeft size={32} className="group-active:-translate-x-1 transition-transform" />
          </button>

          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <span className="text-xs font-bold tracking-widest uppercase opacity-40">
              {isPdf ? "Seite" : isEpub ? "Fortschritt" : "Vorschau"}
            </span>
            <div className="text-lg font-mono font-bold text-emerald-500">
              {isPdf ? (
                <span className="flex items-center gap-2">
                  {pageNum} <span className="opacity-30 text-sm">/</span> {numPages}
                </span>
              ) : isEpub ? (
                epubProgress ? (
                  <span className="flex items-center gap-2">
                    {epubProgress.current} <span className="opacity-30 text-sm">/</span> {epubProgress.total}
                  </span>
                ) : (
                  <span className="opacity-50 text-sm">Lesen…</span>
                )
              ) : (
                "1 / 1"
              )}
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={isLoading || (isPdf && pageNum >= numPages)}
            className="p-3 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-full transition-all disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white group"
          >
            <ChevronRight size={32} className="group-active:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Right: balance spacer */}
        <div className="hidden sm:block w-48 order-3" />
      </div>

      <style>{`
        .epub-viewer iframe { border: none !important; }
      `}</style>
    </div>
  );
}
