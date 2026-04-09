import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import axios from "axios";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("legal_monitor.db");

// Initialize Database
console.log("Initializing SQLite database...");
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_url TEXT,
      title TEXT,
      summary TEXT,
      topic TEXT,
      impact_level TEXT,
      compliance_actions TEXT,
      departments TEXT,
      status TEXT DEFAULT 'pending',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      update_id INTEGER,
      recipient TEXT,
      status TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(update_id) REFERENCES updates(id)
    );
  `);
  console.log("Database initialized successfully.");
} catch (err) {
  console.error("Failed to initialize database:", err);
  process.exit(1);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // Scrape endpoint to bypass CORS
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'LexGuard Legal Monitor/1.0 (mani.k.cst.2025@snsct.org)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });
      const $ = cheerio.load(response.data);
      
      // Basic extraction: title and main text
      const title = $("title").text() || $("h1").first().text();
      // Remove scripts and styles
      $("script, style").remove();
      const text = $("body").text().replace(/\s+/g, ' ').trim().substring(0, 10000); // Limit text size
      
      res.json({ title, text, url });
    } catch (error) {
      // Fallback for SEC.gov or other blocked sites during demo
      if (url.includes("sec.gov") || (axios.isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 404))) {
        console.log(`Using simulated fallback for ${url} due to access restrictions or URL change.`);
        return res.json({ 
          title: "SEC Regulatory Update (Simulated)", 
          text: "The Securities and Exchange Commission today announced new guidance regarding the disclosure of climate-related risks by public companies. The new rules aim to provide investors with more consistent, comparable, and reliable information about the financial effects of climate-related risks on a registrant's business. This update is part of the SEC's ongoing effort to modernize disclosure requirements for the 21st century.",
          url,
          isSimulated: true
        });
      }

      console.error(`Scraping error for ${url}:`, error);
      res.status(500).json({ error: "Failed to scrape URL" });
    }
  });

  // Audit endpoints
  app.get("/api/updates", (req, res) => {
    const updates = db.prepare("SELECT * FROM updates ORDER BY timestamp DESC").all();
    res.json(updates);
  });

  app.post("/api/updates", (req, res) => {
    const { source_url, title, summary, topic, impact_level, compliance_actions, departments, status } = req.body;
    const info = db.prepare(`
      INSERT INTO updates (source_url, title, summary, topic, impact_level, compliance_actions, departments, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(source_url, title, summary, topic, impact_level, compliance_actions, departments, status || 'pending');
    
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/updates/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare("UPDATE updates SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const stats = {
      total: db.prepare("SELECT COUNT(*) as count FROM updates").get().count,
      highImpact: db.prepare("SELECT COUNT(*) as count FROM updates WHERE impact_level = 'High'").get().count,
      pending: db.prepare("SELECT COUNT(*) as count FROM updates WHERE status = 'pending'").get().count
    };
    res.json(stats);
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
