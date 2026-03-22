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
    const book = db.prepare("SELECT filename FROM books WHERE id = ?").get() as any;
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
