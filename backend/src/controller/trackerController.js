import geoip from "geoip-lite";
import { simpleParser } from "mailparser";
import { query } from "../config/db.js";
import { broadcast } from "../services/broadcaster.js";

// 1x1 Transparent GIF buffer (43 bytes)
const PIXEL_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// Helper Sanitasi IP
export const getCleanIP = (req) => {
  let ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || "";
  if (typeof ip === "string" && ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }
  if (typeof ip === "string" && ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  return ip || "127.0.0.1";
};

// Deteksi Mail Proxy & Bot Prefetch
const detectMailProxy = (userAgent = "") => {
  const ua = userAgent.toLowerCase();
  if (ua.includes("googleimageproxy")) {
    return { isProxy: true, clientType: "Google Image Proxy (Prefetch)" };
  }
  if (ua.includes("yahoomailproxy") || ua.includes("yahoo! slurp")) {
    return { isProxy: true, clientType: "Yahoo Mail Proxy" };
  }
  if (ua.includes("apple-pubsub") || ua.includes("applemail") || ua.includes("macintosh; intel mac os x") && ua.includes("cfnetwork")) {
    return { isProxy: true, clientType: "Apple Mail Privacy Proxy" };
  }
  if (ua.includes("bot") || ua.includes("spider") || ua.includes("crawler") || ua.includes("curl") || ua.includes("python")) {
    return { isProxy: true, clientType: "Automated Bot / Scanner" };
  }
  return { isProxy: false, clientType: "Direct Client" };
};

// 1. Ingestion Tracking Pixel
export const handleTrackPixel = async (req, res) => {
  const { id } = req.params;
  const ip = getCleanIP(req);
  const userAgent = req.headers["user-agent"] || "Unknown";

  let geo = geoip.lookup(ip);
  if (!geo && (ip === "127.0.0.1" || ip === "::1" || ip === "localhost")) {
    geo = {
      country: "Localhost",
      city: "Development Machine",
      timezone: "UTC",
    };
  }

  const country = geo?.country || "Unknown";
  const city = geo?.city || "Unknown";
  const timezone = geo?.timezone || "Unknown";

  const { isProxy, clientType } = detectMailProxy(userAgent);

  const logData = {
    email_id: id,
    ip_address: ip,
    user_agent: userAgent,
    country,
    city,
    timezone,
    is_proxy: isProxy,
    client_type: clientType,
    opened_at: new Date().toISOString(),
  };

  try {
    await query(
      `INSERT INTO tracking_logs (email_id, ip_address, user_agent, country, city, timezone, is_proxy, client_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, ip, userAgent, country, city, timezone, isProxy, clientType],
    );
  } catch (err) {
    // Fallback jika kolom is_proxy belum ada di tabel lama
    try {
      await query(
        `INSERT INTO tracking_logs (email_id, ip_address, user_agent, country, city, timezone) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, ip, userAgent, country, city, timezone],
      );
    } catch (insertErr) {
      console.error("Gagal mencatat log pixel:", insertErr.message);
    }
  }

  // Notifikasi real-time via SSE
  broadcast("new_log", logData);

  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": PIXEL_BUFFER.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(PIXEL_BUFFER);
};

// 2. Ambil 20 Log Terakhir
export const handleGetLogs = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        email_id,
        ip_address,
        user_agent,
        country,
        city,
        timezone,
        COALESCE(client_type, 'Direct Client') as client_type,
        COALESCE(is_proxy, false) as is_proxy,
        opened_at
      FROM tracking_logs
      ORDER BY opened_at DESC
      LIMIT 20;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil log: " + err.message });
  }
};

// 3. Parser Header Email & Deteksi Phishing / Spoofing Lanjutan
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

    const senderAddress = parsed.from?.value[0]?.address || "";
    const senderDomain = senderAddress.split("@")[1] || "unknown";
    const displayName = parsed.from?.value[0]?.name || "";
    const replyToAddress = parsed.replyTo?.value[0]?.address || "";
    const replyToDomain = replyToAddress.split("@")[1] || "";

    const forensicDetails = [];
    let riskScore = 0;

    // Evaluasi Protokol
    if (spf === "pass") {
      forensicDetails.push({ message: "SPF lolos: Server pengirim diotorisasi dalam DNS SPF record domain.", isWarning: false });
    } else if (spf === "fail") {
      riskScore += 35;
      forensicDetails.push({ message: "SPF GAGAL: Alamat IP server pengirim TIDAK diotorisasi oleh domain pengirim.", isWarning: true });
    } else {
      riskScore += 10;
      forensicDetails.push({ message: "SPF tidak terverifikasi atau tidak ditemukan pada header.", isWarning: false });
    }

    if (dkim === "pass") {
      forensicDetails.push({ message: "DKIM lolos: Tanda tangan kriptografi email valid dan tidak dimanipulasi.", isWarning: false });
    } else if (dkim === "fail") {
      riskScore += 35;
      forensicDetails.push({ message: "DKIM GAGAL: Tanda tangan digital pesan tidak valid (kemungkinan manipulasi transit).", isWarning: true });
    } else {
      riskScore += 10;
      forensicDetails.push({ message: "DKIM tidak ditemukan pada pesan.", isWarning: false });
    }

    if (dmarc === "pass") {
      forensicDetails.push({ message: "DMARC lolos: Kebijakan perlindungan domain terpenuhi secara penuh.", isWarning: false });
    } else if (dmarc === "fail") {
      riskScore += 40;
      forensicDetails.push({ message: "DMARC GAGAL: Pesan melanggar kebijakan proteksi domain.", isWarning: true });
    } else {
      riskScore += 15;
      forensicDetails.push({ message: "DMARC tidak diterapkan pada domain pengirim.", isWarning: false });
    }

    // Deteksi Brand Spoofing pada Display Name
    const reputableBrands = [
      "paypal", "bca", "mandiri", "bri", "bni", "cimb", "google", "apple",
      "microsoft", "amazon", "netflix", "facebook", "instagram", "whatsapp",
      "tokopedia", "shopee", "gojek", "grab"
    ];

    const lowerDisplay = displayName.toLowerCase();
    for (const brand of reputableBrands) {
      if (lowerDisplay.includes(brand) && !senderDomain.includes(brand)) {
        riskScore += 50;
        forensicDetails.push({
          message: `INDIKASI SPOOFING: Nama pengirim mencantumkan brand '${brand.toUpperCase()}', tetapi alamat domain pengirim adalah '${senderDomain}'.`,
          isWarning: true,
        });
        break;
      }
    }

    // Deteksi Reply-To Mismatch
    if (replyToDomain && replyToDomain !== senderDomain) {
      riskScore += 25;
      forensicDetails.push({
        message: `PERBEDAAN REPLY-TO: Balasan email diarahkan ke '${replyToAddress}', berbeda dari domain pengirim '${senderDomain}'.`,
        isWarning: true,
      });
    }

    // Tentukan Risk Level
    riskScore = Math.min(100, riskScore);
    let riskLevel = "SAFE";
    if (riskScore >= 60 || spf === "fail" || dkim === "fail" || dmarc === "fail") {
      riskLevel = "DANGEROUS";
    } else if (riskScore >= 25 || (spf === "none" && dmarc === "none")) {
      riskLevel = "WARNING";
    }

    const inspectionRecord = {
      sender_domain: senderDomain,
      spf_status: spf,
      dkim_status: dkim,
      dmarc_status: dmarc,
      risk_level: riskLevel,
      risk_score: riskScore,
    };

    try {
      await query(
        `INSERT INTO header_inspections (sender_domain, spf_status, dkim_status, dmarc_status, risk_level, risk_score)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [senderDomain, spf, dkim, dmarc, riskLevel, riskScore],
      );
    } catch (insertErr) {
      // Fallback query lama jika kolom risk_score belum ada
      try {
        await query(
          `INSERT INTO header_inspections (sender_domain, spf_status, dkim_status, dmarc_status, risk_level)
           VALUES ($1, $2, $3, $4, $5)`,
          [senderDomain, spf, dkim, dmarc, riskLevel],
        );
      } catch {
        // Ignored
      }
    }

    return res.json({
      from: parsed.from?.text || senderAddress,
      subject: parsed.subject || "(Tanpa Subjek)",
      results: inspectionRecord,
      details: forensicDetails,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Gagal membedah email header: " + err.message });
  }
};
