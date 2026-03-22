import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Maximize, Minimize, ChevronLeft, ChevronRight, BookOpen, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ePub, { Rendition } from "epubjs";
import * as pdfjsLib from "pdfjs-dist";

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ReaderPage() {
  const { filename } = useParams();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // PDF State
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(() => {
    const saved = localStorage.getItem(`reading_progress_pdf_${filename}`);
    return saved ? parseInt(saved, 10) : 1;
  });
  const [numPages, setNumPages] = useState(0);
  const [epubProgress, setEpubProgress] = useState<{ current: number; total: number } | null>(null);
  const [scale, setScale] = useState(1.5);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // EPUB State
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [theme, setTheme] = useState<"default" | "sepia" | "dark">("default");
  const [fontSize, setFontSize] = useState(100);
  const epubContainerRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Save PDF progress
  useEffect(() => {
    if (isPdf && filename) {
      localStorage.setItem(`reading_progress_pdf_${filename}`, pageNum.toString());
    }
  }, [pageNum, isPdf, filename]);

  const themes = {
    default: {
      body: {
        background: "#ffffff !important",
        color: "#000000 !important",
      }
    },
    sepia: {
      body: {
        background: "#f4ecd8 !important",
        color: "#5b4636 !important",
      }
    },
    dark: {
      body: {
        background: "#18181b !important",
        color: "#d4d4d8 !important",
      }
    }
  };

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
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const fileUrl = `/api/books/content/${filename}`;
  const isPdf = filename?.toLowerCase().endsWith(".pdf");
  const isEpub = filename?.toLowerCase().endsWith(".epub");

  // PDF Rendering Logic
  const renderPage = useCallback(async (num: number, doc: pdfjsLib.PDFDocumentProxy) => {
    if (!canvasRef.current) return;
    
    try {
      const page = await doc.getPage(num);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
    } catch (err) {
      console.error("Error rendering PDF page:", err);
    }
  }, [scale]);

  // Load PDF
  useEffect(() => {
    if (!isPdf || !filename) return;
    
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);
        renderPage(pageNum, doc); // Use saved pageNum
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("PDF konnte nicht geladen werden.");
        setIsLoading(false);
      }
    };
    
    loadPdf();
  }, [isPdf, filename, fileUrl, renderPage]);

  // Handle PDF Page Change
  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum, pdfDoc);
    }
  }, [pageNum, pdfDoc, renderPage]);

  // Load EPUB
  useEffect(() => {
    if (!isEpub || !filename || !epubContainerRef.current) return;
    
    const book = ePub(fileUrl);
    const rend = book.renderTo(epubContainerRef.current, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      manager: "default",
    });
    
    const savedLocation = localStorage.getItem(`reading_progress_epub_${filename}`);
    
    rend.display(savedLocation || undefined).then(() => {
      setIsLoading(false);
      // Register themes
      rend.themes.register("default", themes.default);
      rend.themes.register("sepia", themes.sepia);
      rend.themes.register("dark", themes.dark);
      rend.themes.select(theme);
    }).catch(err => {
      console.error("Error displaying EPUB:", err);
      setError("EPUB konnte nicht geladen werden.");
      setIsLoading(false);
    });
    
    rend.on("relocated", (location: any) => {
      if (filename) {
        localStorage.setItem(`reading_progress_epub_${filename}`, location.start.cfi);
        
        // Try to get page info if available
        if (location.start.displayed) {
          setEpubProgress({
            current: location.start.displayed.page,
            total: location.start.displayed.total
          });
        }
      }
    });
    
    setRendition(rend);
    
    const handleResize = () => {
      rend.resize();
    };
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      book.destroy();
    };
  }, [isEpub, filename, fileUrl]);

  // Update EPUB theme and font size when they change
  useEffect(() => {
    if (rendition) {
      rendition.themes.select(theme);
      rendition.themes.fontSize(`${fontSize}%`);
    }
  }, [theme, fontSize, rendition]);

  const handlePrev = () => {
    if (isPdf && pageNum > 1) {
      setPageNum(prev => prev - 1);
    } else if (isEpub && rendition) {
      rendition.prev();
    }
  };

  const handleNext = () => {
    if (isPdf && pageNum < numPages) {
      setPageNum(prev => prev + 1);
    } else if (isEpub && rendition) {
      rendition.next();
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 bg-zinc-950 flex flex-col z-[100] font-sans">
      {/* Reader Header */}
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
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-auto flex items-center justify-center relative transition-colors duration-300 ${isEpub && theme === 'dark' ? 'bg-zinc-950' : isEpub && theme === 'sepia' ? 'bg-[#e8dfc8]' : 'bg-zinc-900'}`}>
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-900 gap-4 text-emerald-500"
            >
              <Loader2 size={48} className="animate-spin" />
              <p className="text-sm font-medium animate-pulse">Buch wird vorbereitet...</p>
            </motion.div>
          )}
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
                  <img 
                    src={fileUrl} 
                    alt="Book Content" 
                    className="max-w-full max-h-full object-contain shadow-lg"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Reader Footer Controls */}
      <div className="bg-zinc-900/95 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-6 text-white border-t border-white/5">
        {/* Left: Visibility Options */}
        <div className="flex items-center gap-4 order-2 sm:order-1">
          {isEpub && (
            <>
              <div className="flex items-center bg-zinc-800 rounded-lg p-1">
                <button 
                  onClick={() => setFontSize(s => Math.max(50, s - 10))}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                  title="Schrift verkleinern"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono w-10 text-center opacity-60">
                  {fontSize}%
                </span>
                <button 
                  onClick={() => setFontSize(s => Math.min(200, s + 10))}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                  title="Schrift vergrößern"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
              <div className="flex items-center bg-zinc-800 rounded-lg p-1">
                <button 
                  onClick={() => setTheme("default")}
                  className={`w-6 h-6 rounded-md border border-white/10 m-0.5 transition-all ${theme === "default" ? "ring-2 ring-emerald-500 scale-110" : "hover:scale-105"}`}
                  style={{ background: "#ffffff" }}
                  title="Hell"
                />
                <button 
                  onClick={() => setTheme("sepia")}
                  className={`w-6 h-6 rounded-md border border-white/10 m-0.5 transition-all ${theme === "sepia" ? "ring-2 ring-emerald-500 scale-110" : "hover:scale-105"}`}
                  style={{ background: "#f4ecd8" }}
                  title="Sepia"
                />
                <button 
                  onClick={() => setTheme("dark")}
                  className={`w-6 h-6 rounded-md border border-white/10 m-0.5 transition-all ${theme === "dark" ? "ring-2 ring-emerald-500 scale-110" : "hover:scale-105"}`}
                  style={{ background: "#18181b" }}
                  title="Dunkel"
                />
              </div>
            </>
          )}

          {isPdf && (
            <div className="flex items-center bg-zinc-800 rounded-lg p-1">
              <button 
                onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-mono w-12 text-center opacity-60">
                {Math.round(scale * 100)}%
              </span>
              <button 
                onClick={() => setScale(s => Math.min(3, s + 0.2))}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
              >
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
          
          <div className="flex flex-col items-center gap-1">
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
                  "Lesen..."
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

        {/* Right: Empty space for balance on desktop */}
        <div className="hidden sm:block w-48 order-3" />
      </div>

      {/* Global styles for EPUB.js iframe content if needed */}
      <style>{`
        .epub-viewer iframe {
          border: none !important;
        }
      `}</style>
    </div>
  );
}
