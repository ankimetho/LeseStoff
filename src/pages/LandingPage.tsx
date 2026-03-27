import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowRight, Calendar, Clock, CheckCircle2 } from "lucide-react";
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
    <div className="space-y-12">
      <header className="text-center space-y-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl"
        >
          Hallo Kira, Zeit zum <span className="text-emerald-600">Lesen!</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl text-gray-500 max-w-2xl mx-auto"
        >
          Entdecke heute neue Geschichten und lerne etwas Spannendes.
        </motion.p>
      </header>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-2xl mx-auto"
      >
        {task ? (
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center text-center space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />

            <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <BookOpen size={40} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-600 uppercase tracking-wider">
                <Calendar size={14} />
                Heutige Aufgabe
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{task.book_title}</h2>
            </div>

            <Link
              to={`/read/${task.filename}`}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all hover:gap-4 shadow-lg shadow-emerald-600/20"
            >
              Jetzt lesen
              <ArrowRight size={20} />
            </Link>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-3xl p-12 border-2 border-dashed border-gray-200 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mx-auto">
              <Calendar size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900">Keine Aufgabe für heute</h3>
              <p className="text-gray-500">Frag deine Eltern, ob sie etwas für dich planen können!</p>
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
          <h2 className="text-2xl font-bold text-gray-900 text-center">Deine Bücher</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                    className="block bg-white rounded-2xl p-5 shadow-md shadow-gray-100 border border-gray-100 hover:shadow-lg hover:shadow-emerald-100 hover:border-emerald-200 transition-all group relative overflow-hidden"
                  >
                    {completed && (
                      <div className="absolute top-3 right-3 text-emerald-500">
                        <CheckCircle2 size={20} />
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-100 transition-colors">
                        <BookOpen size={24} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                          {book.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          <span className="uppercase font-medium">{getFileType(book.filename)}</span>
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
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-gray-500">Fortschritt</span>
                          <span className="font-medium text-emerald-600">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.5 + idx * 0.05, duration: 0.5 }}
                            className={cn(
                              "h-full rounded-full",
                              completed ? "bg-emerald-500" : "bg-gradient-to-r from-emerald-400 to-teal-400"
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {pct > 0 ? "Weiterlesen" : "Jetzt lesen"}
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
