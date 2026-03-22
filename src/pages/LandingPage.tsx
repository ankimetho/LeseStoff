import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowRight, Calendar } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

interface DailyTask {
  id: number;
  book_id: number;
  date: string;
  book_title: string;
  filename: string;
}

export default function LandingPage() {
  const [task, setTask] = useState<DailyTask | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/daily-task")
      .then((res) => res.json())
      .then((data) => {
        setTask(data);
        setLoading(false);
      });
  }, []);

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
          Hallo, Zeit zum <span className="text-emerald-600">Lesen!</span>
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

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
        {[
          { title: "Konzentriert", desc: "Keine Ablenkung beim Lesen.", color: "bg-blue-50 text-blue-600" },
          { title: "Einfach", desc: "Alles mit einem Klick finden.", color: "bg-purple-50 text-purple-600" },
          { title: "Geplant", desc: "Jeden Tag eine neue Geschichte.", color: "bg-orange-50 text-orange-600" },
        ].map((feat, i) => (
          <motion.div 
            key={feat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
          >
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4", feat.color)}>
              <BookOpen size={20} />
            </div>
            <h4 className="font-bold text-gray-900 mb-1">{feat.title}</h4>
            <p className="text-sm text-gray-500">{feat.desc}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
