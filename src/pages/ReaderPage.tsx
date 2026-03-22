import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Maximize, Minimize, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function ReaderPage() {
  const { filename } = useParams();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black flex flex-col z-[100]">
      {/* Reader Header - Auto-hide in future? */}
      <div className="bg-zinc-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between text-white border-b border-white/10">
        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Zurück</span>
        </button>
        
        <h1 className="text-sm font-bold tracking-widest uppercase opacity-60 truncate max-w-[50%]">
          {filename}
        </h1>

        <button 
          onClick={toggleFullscreen}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-[#fdfcfb] flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl h-full bg-white shadow-2xl rounded-lg overflow-hidden border border-black/5">
          {isPdf ? (
            <div className="w-full h-full relative">
              <iframe 
                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-none"
                title="PDF Reader"
              />
              {/* Fallback overlay that shows up if the iframe is blocked or empty */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-white/50 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity">
                <div className="bg-white p-8 rounded-2xl shadow-2xl border border-black/5 flex flex-col items-center space-y-4 pointer-events-auto">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <BookOpen size={24} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-gray-900">Probleme beim Laden?</h3>
                    <p className="text-sm text-gray-500">Klicke hier, um das Buch direkt zu öffnen.</p>
                  </div>
                  <a 
                    href={fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all"
                  >
                    Buch öffnen
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
              <img 
                src={fileUrl} 
                alt="Book Content" 
                className="max-w-full max-h-full object-contain shadow-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden space-y-4">
                <p className="text-gray-500 italic">Dieses Dateiformat wird direkt im Browser angezeigt.</p>
                <a 
                  href={fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold"
                >
                  Datei öffnen
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reader Footer - Navigation Controls (Simplified) */}
      <div className="bg-zinc-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-center gap-8 text-white">
        <button className="p-3 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30" disabled>
          <ChevronLeft size={24} />
        </button>
        <span className="text-sm font-mono opacity-60">Fokus-Modus Aktiv</span>
        <button className="p-3 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30" disabled>
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
