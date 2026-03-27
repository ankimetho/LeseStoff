import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowRight, Calendar, Clock, CheckCircle2, Sparkles, Star, PartyPopper } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

interface DailyTask {
  id: number;
  book_id: number;
  date: string;
  book_title: string;
  filename: string;
}

interface Book {
  id: number;
  title: string;
  filename: string;
  mimetype: string;
  size: number;
  created_at: string;
}

interface ReadingProgress {
  id: number;
  book_id: number;
  position: string;
  progress_percent: number;
  completed: number;
  time_spent_seconds: number;
  last_read: string;
  book_title: string;
  filename: string;
}

export default function LandingPage() {
  const [task, setTask] = useState<DailyTask | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [progressMap, setProgressMap] = useState<Map<number, ReadingProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/daily-task").then((res) => res.json()),
      fetch("/api/books").then((res) => res.json()),
      fetch("/api/progress").then((res) => res.json()),
    ]).then(([taskData, booksData, progressData]) => {
      setTask(taskData);
      setBooks(booksData);
      const pm = new Map<number, ReadingProgress>();
      (progressData as ReadingProgress[]).forEach((p) => pm.set(p.book_id, p));
      setProgressMap(pm);
      setLoading(false);
    });
  }, []);

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} Min`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hours} Std ${remainMins} Min` : `${hours} Std`;
  }

  function getFileType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    return ext === "pdf" ? "PDF" : ext === "epub" ? "EPUB" : ext || "";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400 font-medium">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.18em] text-sky-600 shadow-lg shadow-sky-100"
          >
            <Sparkles size={14} />
            Woozelifiziert
          </motion.div>

          <header className="space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl text-4xl font-black tracking-tight text-slate-900"
            >
              Hallo Kira,
              <span className="block text-sky-600">Zeit für ein</span>
              <span className="block text-rose-500">Woozel-3001-Leseabenteuer!</span>
            </motion.h1>

            
          </header>

        </div>
      </section>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-3xl"
      >
        {task ? (
          <div className="relative overflow-hidden rounded-[2rem] border border-sky-100 bg-white/90 p-5 shadow-[0_20px_70px_rgba(49,130,206,0.14)] backdrop-blur-xl">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-200/55 blur-3xl" />
            <div className="absolute left-6 top-0 h-2 w-40 rounded-b-full bg-gradient-to-r from-sky-400 via-cyan-400 to-amber-300" />

            <div className="relative flex flex-col gap-6">
              <div className="space-y-4">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-sky-50 px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-sky-600">
                  <Calendar size={14} />
                  Heutige Woozel-Mission
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900">{task.book_title}</h2>
                  <p className="max-w-xl text-slate-600">
                    Woozel hat schon den Lesesessel warmgemacht. Ein Klick und ihr startet direkt in die heutige Geschichte.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-sky-100 via-cyan-50 to-amber-50 text-sky-600 shadow-inner">
                  <BookOpen size={38} />
                </div>

                <Link
                  to={`/read/${task.filename}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-4 text-base font-black text-white transition-all hover:gap-3 hover:bg-rose-600 hover:shadow-xl hover:shadow-rose-200"
                >
                  Jetzt mit Woozel lesen
                  <ArrowRight size={20} />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-[2rem] border-2 border-dashed border-sky-200 bg-white/80 p-8 text-center shadow-lg shadow-sky-100">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-400">
              <Calendar size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Keine Mission für heute</h3>
              <p className="text-slate-500">Woozel wartet noch auf die nächste Geschichte. Frag deine Eltern nach neuem Lesefutter.</p>
            </div>
          </div>
        )}
      </motion.div>

      {books.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">Buecherregal</p>
              <h2 className="text-2xl font-black text-slate-900">Deine Woozel-Bibliothek</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {books.map((book, idx) => {
              const progress = progressMap.get(book.id);
              const pct = progress?.progress_percent ?? 0;
              const completed = progress?.completed === 1;
              const timeSpent = progress?.time_spent_seconds ?? 0;

              return (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + idx * 0.05 }}
                >
                  <Link
                    to={`/read/${book.filename}`}
                    className="group relative block overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white/90 p-5 shadow-[0_16px_40px_rgba(28,108,159,0.10)] transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_24px_50px_rgba(28,108,159,0.16)]"
                  >
                    <div className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300 opacity-80" />

                    {completed && (
                      <div className="absolute right-4 top-4 text-emerald-500">
                        <CheckCircle2 size={20} />
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 transition-colors group-hover:bg-sky-100">
                        <BookOpen size={24} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="truncate font-black text-slate-900 transition-colors group-hover:text-sky-600">
                          {book.title}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-black uppercase tracking-[0.18em] text-slate-500">
                            {getFileType(book.filename)}
                          </span>
                          {timeSpent > 0 && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatTime(timeSpent)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {pct > 0 && (
                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Fortschritt</span>
                          <span className="font-black text-sky-600">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.5 + idx * 0.05, duration: 0.5 }}
                            className={cn(
                              "h-full rounded-full",
                              completed ? "bg-emerald-500" : "bg-gradient-to-r from-sky-400 via-cyan-400 to-amber-300"
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-center gap-1 text-sm font-black text-rose-500 opacity-0 transition-opacity group-hover:opacity-100">
                      {pct > 0 ? "Weiterwoozen" : "Jetzt lesen"}
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

    </div>
  );
}
