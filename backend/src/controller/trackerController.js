import { pool } from "../config/db.js";
import { simpleParser } from "mailparser";

// 1x1 Transparent GIF buffer (43 bytes)
const PIXEL_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// 1. Ingestion Pixel
export const handleTrackPixel = async (req, res) => {
  const { id } = req.params;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "Unknown";

  try {
    await pool.query(
      "INSERT INTO tracking_logs (email_id, ip_address, user_agent) VALUES ($1, $2, $3)",
      [id, ip, userAgent],
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
};

// 2. Parser Raw Header (Deteksi Phishing)
export const handleInspectHeader = async (req, res) => {
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
};
