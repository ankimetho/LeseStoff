import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import Database from "better-sqlite3";
import fs from "fs";

const __dirname = path.resolve();
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_PATH = path.join(__dirname, "lesestoff.db");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const db = new Database(DB_PATH);

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reading_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id TEXT DEFAULT 'default',
    position TEXT, -- page number or EPUB CFI
    progress_percent REAL DEFAULT 0,
    completed INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    last_read DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE(book_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id TEXT DEFAULT 'default',
    duration_seconds INTEGER NOT NULL,
    pages_read INTEGER DEFAULT 0,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );
`);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/books", (req, res) => {
    const books = db.prepare("SELECT * FROM books ORDER BY created_at DESC").all();
    res.json(books);
  });

  app.post("/api/books/upload", upload.array("books"), (req, res) => {
    const files = req.files as Express.Multer.File[];
    const stmt = db.prepare(
      "INSERT INTO books (title, filename, mimetype, size) VALUES (?, ?, ?, ?)"
    );

    const results = files.map((file) => {
      const info = stmt.run(file.originalname, file.filename, file.mimetype, file.size);
      return { id: info.lastInsertRowid, title: file.originalname };
    });

    res.json({ success: true, books: results });
  });

  app.delete("/api/books/:id", (req, res) => {
    const { id } = req.params;
    const book = db.prepare("SELECT filename FROM books WHERE id = ?").get(id) as any;
    if (book) {
      const filePath = path.join(UPLOADS_DIR, book.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.prepare("DELETE FROM books WHERE id = ?").run(id);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Book not found" });
    }
  });

  app.get("/api/schedule", (req, res) => {
    const schedule = db.prepare(`
      SELECT s.*, b.title as book_title 
      FROM schedule s 
      JOIN books b ON s.book_id = b.id
      ORDER BY s.date ASC
    `).all();
    res.json(schedule);
  });

  app.post("/api/schedule", (req, res) => {
    const { book_id, date } = req.body;
    db.prepare("INSERT INTO schedule (book_id, date) VALUES (?, ?)").run(book_id, date);
    res.json({ success: true });
  });

  app.delete("/api/schedule/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM schedule WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/daily-task", (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const task = db.prepare(`
      SELECT s.*, b.title as book_title, b.filename
      FROM schedule s
      JOIN books b ON s.book_id = b.id
      WHERE s.date = ?
      LIMIT 1
    `).get(today) as any;
    res.json(task || null);
  });

  // Reading progress endpoints
  app.get("/api/progress", (req, res) => {
    const { user_id = 'default' } = req.query;
    const progress = db.prepare(`
      SELECT p.*, b.title as book_title, b.filename
      FROM reading_progress p
      JOIN books b ON p.book_id = b.id
      WHERE p.user_id = ?
      ORDER BY p.last_read DESC
    `).all(user_id);
    res.json(progress);
  });

  app.get("/api/progress/:bookId", (req, res) => {
    const { bookId } = req.params;
    const { user_id = 'default' } = req.query;
    const progress = db.prepare(`
      SELECT * FROM reading_progress
      WHERE book_id = ? AND user_id = ?
    `).get(bookId, user_id);
    res.json(progress || null);
  });

  // Get/save progress by filename (for the reader, which only knows the filename)
app.get("/api/progress/by-filename/:filename", (req, res) => {
  const { filename } = req.params;
  const decodedFilename = decodeURIComponent(filename);
  const { user_id = 'default' } = req.query;
  const book = db.prepare("SELECT id FROM books WHERE filename = ?").get(decodedFilename) as any;
  if (!book) return res.json(null);
  const progress = db.prepare(`
    SELECT * FROM reading_progress WHERE book_id = ? AND user_id = ?
  `).get(book.id, user_id);
  res.json(progress ? { ...progress, book_id: book.id } : { book_id: book.id });
});

app.post("/api/progress/by-filename/:filename", (req, res) => {
  const { filename } = req.params;
  const decodedFilename = decodeURIComponent(filename);
  const { user_id = 'default', position, progress_percent, completed, time_spent_seconds } = req.body;
  const book = db.prepare("SELECT id FROM books WHERE filename = ?").get(decodedFilename) as any;
  if (!book) return res.status(404).json({ error: "Book not found" });
  db.prepare(`
    INSERT INTO reading_progress (book_id, user_id, position, progress_percent, completed, time_spent_seconds, last_read)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(book_id, user_id) DO UPDATE SET
    position = excluded.position,
    progress_percent = excluded.progress_percent,
    completed = excluded.completed,
    time_spent_seconds = time_spent_seconds + excluded.time_spent_seconds,
    last_read = CURRENT_TIMESTAMP
  `).run(book.id, user_id, position, progress_percent || 0, completed ? 1 : 0, time_spent_seconds || 0);
  res.json({ success: true, book_id: book.id });
});

app.post("/api/session/by-filename/:filename", (req, res) => {
  const { filename } = req.params;
  const decodedFilename = decodeURIComponent(filename);
  const { user_id = 'default', duration_seconds, pages_read } = req.body;
  const book = db.prepare("SELECT id FROM books WHERE filename = ?").get(decodedFilename) as any;
  if (!book) return res.status(404).json({ error: "Book not found" });
  db.prepare(`
    INSERT INTO session_logs (book_id, user_id, duration_seconds, pages_read)
    VALUES (?, ?, ?, ?)
  `).run(book.id, user_id, duration_seconds, pages_read || 0);
  res.json({ success: true });
});

  app.post("/api/progress", (req, res) => {
    const { book_id, user_id = 'default', position, progress_percent, completed, time_spent_seconds } = req.body;
    
    // Upsert reading progress
    db.prepare(`
      INSERT INTO reading_progress (book_id, user_id, position, progress_percent, completed, time_spent_seconds, last_read)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(book_id, user_id) DO UPDATE SET
        position = excluded.position,
        progress_percent = excluded.progress_percent,
        completed = excluded.completed,
        time_spent_seconds = time_spent_seconds + excluded.time_spent_seconds,
        last_read = CURRENT_TIMESTAMP
    `).run(book_id, user_id, position, progress_percent, completed ? 1 : 0, time_spent_seconds || 0);

    res.json({ success: true });
  });

  app.post("/api/session", (req, res) => {
    const { book_id, user_id = 'default', duration_seconds, pages_read } = req.body;
    db.prepare(`
      INSERT INTO session_logs (book_id, user_id, duration_seconds, pages_read)
      VALUES (?, ?, ?, ?)
    `).run(book_id, user_id, duration_seconds, pages_read || 0);
    res.json({ success: true });
  });

  // Statistics endpoint
  app.get("/api/stats", (req, res) => {
    const { user_id = 'default' } = req.query;
    
    // Total books read (completed)
    const totalBooksRead = db.prepare(`
      SELECT COUNT(*) as count FROM reading_progress
      WHERE user_id = ? AND completed = 1
    `).get(user_id) as { count: number };

    // Total time spent (all time)
    const totalTime = db.prepare(`
      SELECT COALESCE(SUM(time_spent_seconds), 0) as total FROM reading_progress
      WHERE user_id = ?
    `).get(user_id) as { total: number };

    // Current streak (consecutive days with reading)
    const sessions = db.prepare(`
      SELECT DATE(logged_at) as date
      FROM session_logs
      WHERE user_id = ?
      GROUP BY DATE(logged_at)
      ORDER BY date DESC
    `).all(user_id) as { date: string }[];

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let expectedDate = today;
    
    for (const session of sessions) {
      if (session.date === expectedDate) {
        streak++;
        const prevDate = new Date(expectedDate);
        prevDate.setDate(prevDate.getDate() - 1);
        expectedDate = prevDate.toISOString().split('T')[0];
      } else if (session.date < expectedDate) {
        break;
      }
    }

    // Books in progress
    const booksInProgress = db.prepare(`
      SELECT COUNT(*) as count FROM reading_progress
      WHERE user_id = ? AND completed = 0 AND progress_percent > 0
    `).get(user_id) as { count: number };

    // Recent sessions (last 7 days)
    const recentSessions = db.prepare(`
      SELECT DATE(logged_at) as date, SUM(duration_seconds) as duration
      FROM session_logs
      WHERE user_id = ? AND logged_at >= datetime('now', '-7 days')
      GROUP BY DATE(logged_at)
      ORDER BY date DESC
    `).all(user_id) as { date: string; duration: number }[];

    res.json({
      totalBooksRead: totalBooksRead.count,
      totalTimeSeconds: totalTime.total,
      currentStreak: streak,
      booksInProgress: booksInProgress.count,
      recentSessions: recentSessions.map(s => ({ date: s.date, durationMinutes: Math.round(s.duration / 60) }))
    });
  });

  // Serve book files
  app.get("/api/books/content/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
      res.setHeader("X-Frame-Options", "ALLOWALL");
      res.setHeader("Content-Disposition", "inline; filename=\"" + filename + "\"");
      res.sendFile(filePath);
    } else {
      res.status(404).send("File not found");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
