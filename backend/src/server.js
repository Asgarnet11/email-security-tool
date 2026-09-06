import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import geoip from "geoip-lite";
import { simpleParser } from "mailparser";

dotenv.config();

const { Pool } = pkg;
const app = express();

// 1. Inisialisasi Database Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// 2. Setup CORS (Fleksibel untuk Lokal, IP LAN, dan Domain Production)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (seperti curl, mobile app, atau direct pixel img tag)
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://192.168.")
      ) {
        return callback(null, true);
      }
      return callback(new Error("Akses diblokir oleh CORS policy"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));

// 1x1 Transparent GIF Buffer (43 bytes)
const PIXEL_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// Helper Sanitasi IP
const getCleanIP = (req) => {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  if (ip.startsWith("::ffff:")) ip = ip.substring(7);
  return ip;
};

// ==========================================
// ROUTES: EMAIL TRACKER & SECURITY
// ==========================================

// Route A: Ingestion Pixel Email
app.get("/track/px/:id.gif", async (req, res) => {
  const { id } = req.params;
  const ip = getCleanIP(req);
  const userAgent = req.headers["user-agent"] || "Unknown";

  let geo = geoip.lookup(ip);
  if (!geo && (ip === "127.0.0.1" || ip === "::1" || ip === "localhost")) {
    geo = {
      country: "Local Machine",
      city: "Development Server",
      timezone: "UTC",
    };
  }

  const country = geo?.country || "Unknown";
  const city = geo?.city || "Unknown";
  const timezone = geo?.timezone || "Unknown";

  try {
    await pool.query(
      `INSERT INTO tracking_logs (email_id, ip_address, user_agent, country, city, timezone) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, ip, userAgent, country, city, timezone],
    );
  } catch (err) {
    console.error("Gagal mencatat log pixel:", err.message);
  }

  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": PIXEL_BUFFER.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(PIXEL_BUFFER);
});

// Route B: Mengambil 20 Log Pembukaan Email Terakhir
app.get("/api/logs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        email_id,
        ip_address,
        user_agent,
        country,
        city,
        timezone,
        opened_at
      FROM tracking_logs
      ORDER BY opened_at DESC
      LIMIT 20;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil log: " + err.message });
  }
});

// Route C: Parser Header Email (Anti-Phishing Inspection)
app.post("/api/inspect", async (req, res) => {
  const { rawHeader } = req.body;
  if (!rawHeader) {
    return res.status(400).json({ error: "Raw header wajib diisi" });
  }

  try {
    const parsed = await simpleParser(rawHeader);
    const authResults = parsed.headers.get("authentication-results") || "";

    const checkStatus = (key) => {
      const match = authResults.match(new RegExp(`${key}=(\\w+)`, "i"));
      return match ? match[1].toLowerCase() : "none";
    };

    const spf = checkStatus("spf");
    const dkim = checkStatus("dkim");
    const dmarc = checkStatus("dmarc");

    let riskLevel = "SAFE";
    if (spf === "fail" || dkim === "fail" || dmarc === "fail") {
      riskLevel = "DANGEROUS";
    } else if (spf === "none" && dmarc === "none") {
      riskLevel = "WARNING";
    }

    const insertResult = await pool.query(
      `INSERT INTO header_inspections (sender_domain, spf_status, dkim_status, dmarc_status, risk_level)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        parsed.from?.value[0]?.address?.split("@")[1] || "unknown",
        spf,
        dkim,
        dmarc,
        riskLevel,
      ],
    );

    return res.json({
      from: parsed.from?.text,
      subject: parsed.subject,
      results: insertResult.rows[0],
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Gagal membedah email header: " + err.message });
  }
});

// ==========================================
// ROUTES: DEVICE GPS TELEMETRY
// ==========================================

// Route D: Ingestion Koordinat dari HP
app.post("/api/telemetry", async (req, res) => {
  const {
    device_id,
    latitude,
    longitude,
    speed = 0,
    battery_level = 100,
  } = req.body;

  if (!device_id || latitude === undefined || longitude === undefined) {
    return res
      .status(400)
      .json({ error: "device_id, latitude, dan longitude wajib diisi" });
  }

  try {
    // Simpan titik baru
    const insertQuery = `
      INSERT INTO device_locations (device_id, latitude, longitude, speed, battery_level)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      device_id,
      latitude,
      longitude,
      speed,
      battery_level,
    ]);

    // Bersihkan buffer (simpan maksimal 200 titik jejak terakhir per device)
    await pool.query(
      `DELETE FROM device_locations
       WHERE id IN (
         SELECT id FROM device_locations
         WHERE device_id = $1
         ORDER BY recorded_at DESC
         OFFSET 200
       )`,
      [device_id],
    );

    res.status(201).json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Gagal menyimpan telemetri: " + err.message });
  }
});

// Route E: Ambil Daftar Semua Device Terdaftar
app.get("/api/devices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        device_id, 
        MAX(recorded_at) as last_seen,
        COUNT(*) as total_points
      FROM device_locations
      GROUP BY device_id
      ORDER BY last_seen DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Gagal mengambil daftar device: " + err.message });
  }
});

// Route F: Ambil Riwayat Koordinat Device Terpilih
app.get("/api/telemetry/:device_id", async (req, res) => {
  const { device_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT latitude, longitude, speed, battery_level, recorded_at
       FROM device_locations
       WHERE device_id = $1
       ORDER BY recorded_at ASC
       LIMIT 100`,
      [device_id],
    );
    res.json(result.rows);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Gagal mengambil data rute peta: " + err.message });
  }
});

// ==========================================
// SERVER BINDING
// ==========================================
const PORT = process.env.PORT || 5000;

// Binding ke 0.0.0.0 agar bisa diakses baik dari localhost maupun IP LAN HP
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend Sentinel aktif di port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
});
