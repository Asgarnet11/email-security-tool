import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  handleTrackPixel,
  handleGetLogs,
  handleInspectHeader,
} from "./controller/trackerController.js";
import {
  handleIngestTelemetry,
  handleGetDevices,
  handleGetDeviceTelemetry,
} from "./controller/telemetryController.js";
import { addClient } from "./services/broadcaster.js";

dotenv.config();

const app = express();

// Trust reverse proxy (Vercel, Nginx, Cloudflare)
app.set("trust proxy", true);

// Setup CORS
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));

// ==========================================
// SECURITY: LIGHTWEIGHT IN-MEMORY RATE LIMITER
// ==========================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 Menit
const MAX_REQUESTS_PER_WINDOW = 120; // 120 request/menit per IP

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now - record.startTime > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return next();
  }

  record.count += 1;
  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: "Terlalu banyak permintaan (Rate limit exceeded). Coba lagi beberapa saat lagi.",
    });
  }

  next();
};

// Pembersihan berkala memori rate-limiter setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ==========================================
// ROUTES: EMAIL TRACKER & SECURITY
// ==========================================
// 1. Ingestion Tracking Pixel
app.get("/track/px/:id.gif", rateLimiter, handleTrackPixel);

// 2. Log Pembukaan Email
app.get("/api/logs", handleGetLogs);

// 3. Inspeksi Header Anti-Phishing & Spoofing
app.post("/api/inspect", rateLimiter, handleInspectHeader);

// ==========================================
// ROUTES: DEVICE GPS TELEMETRY
// ==========================================
// 4. Ingestion Telemetri Perangkat
app.post("/api/telemetry", rateLimiter, handleIngestTelemetry);

// 5. Daftar Perangkat Terdaftar
app.get("/api/devices", handleGetDevices);

// 6. Riwayat Rute Perangkat
app.get("/api/telemetry/:device_id", handleGetDeviceTelemetry);

// ==========================================
// ROUTE: REAL-TIME SERVER-SENT EVENTS (SSE)
// ==========================================
// 7. Live Stream Channel untuk Frontend
app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("event: connected\ndata: {}\n\n");
  addClient(res);
});

// Root Healthcheck
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Security & Telemetry Sentinel",
    timestamp: new Date().toISOString(),
  });
});

export default app;
