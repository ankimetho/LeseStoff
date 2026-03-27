import { useState, useEffect } from "react";
import { Upload, Trash2, Calendar, Book, Plus, X, Check } from "lucide-react";
import { format, addDays, startOfToday } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

interface Book {
  id: number;
  title: string;
  filename: string;
  created_at: string;
}

interface ScheduleItem {
  id: number;
  book_id: number;
  date: string;
  book_title: string;
}

export default function AdminPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [activeTab, setActiveTab] = useState<"library" | "schedule">("library");
  const [uploading, setUploading] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [booksRes, scheduleRes] = await Promise.all([
      fetch("/api/books"),
      fetch("/api/schedule"),
    ]);
    setBooks(await booksRes.json());
    setSchedule(await scheduleRes.json());
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(e.target.files).forEach((file) => {
      formData.append("books", file);
    });

    try {
      await fetch("/api/books/upload", {
        method: "POST",
        body: formData,
      });
      fetchData();
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  const deleteBook = async (id: number) => {
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    fetchData();
    setDeletingId(null);
  };

  const addToSchedule = async () => {
    if (!selectedBookId) return;
    await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: selectedBookId, date: selectedDate }),
    });
    fetchData();
    setSelectedBookId("");
  };

  const deleteFromSchedule = async (id: number) => {
    await fetch(`/api/schedule/${id}`, { method: "DELETE" });
    fetchData();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Zone</h1>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("library")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === "library" ? "bg-white shadow-sm text-emerald-600" : "text-gray-500"
            )}
          >
            Bibliothek
          </button>
          <button 
            onClick={() => setActiveTab("schedule")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === "schedule" ? "bg-white shadow-sm text-emerald-600" : "text-gray-500"
            )}
          >
            Zeitplan
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "library" ? (
          <motion.div 
            key="library"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center space-y-4 relative group hover:border-emerald-400 transition-colors">
              <input 
                type="file" 
                multiple 
                onChange={handleUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-gray-900">
                  {uploading ? "Wird hochgeladen..." : "Bücher hochladen"}
                </h3>
                <p className="text-gray-500">Klicke hier oder ziehe Dateien in diesen Bereich (PDF, Bilder, Text).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((book) => (
                <div key={book.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                      <Book size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{book.title}</p>
                      <p className="text-xs text-gray-400">{format(new Date(book.created_at), "dd. MMM yyyy", { locale: de })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deletingId === book.id ? (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => deleteBook(book.id)}
                          className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <Check size={14} />
                        </button>
                        <button 
                          onClick={() => setDeletingId(null)}
                          className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
              <button
                onClick={() => setDeletingId(book.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                <Trash2 size={18} />
              </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="schedule"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Buch auswählen</label>
                <select 
                  value={selectedBookId} 
                  onChange={(e) => setSelectedBookId(Number(e.target.value))}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Wähle ein Buch...</option>
                  {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </div>
              <div className="space-y-2 w-full sm:w-auto">
                <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Datum</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button 
                onClick={addToSchedule}
                disabled={!selectedBookId}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all"
              >
                <Plus size={20} />
                Planen
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Calendar size={24} className="text-emerald-600" />
                Geplante Aufgaben
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {schedule.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                        {format(new Date(item.date), "dd.MM.yyyy")}
                      </div>
                      <p className="font-bold text-gray-900">{item.book_title}</p>
                    </div>
                    <button 
                      onClick={() => deleteFromSchedule(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
                {schedule.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-gray-400">
                    Noch keine Aufgaben geplant.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
