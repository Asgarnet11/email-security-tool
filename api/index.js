import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import geoip from 'geoip-lite';
import { simpleParser } from 'mailparser';

const { Pool } = pkg;
const app = express();

// Pool Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PIXEL_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const getCleanIP = (req) => {
  let ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  return ip;
};

// Route Pixel
app.get('/track/px/:id.gif', async (req, res) => {
  const { id } = req.params;
  const ip = getCleanIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';

  let geo = geoip.lookup(ip);
  const country = geo?.country || 'Unknown';
  const city = geo?.city || 'Unknown';
  const timezone = geo?.timezone || 'Unknown';

  try {
    await pool.query(
      `INSERT INTO tracking_logs (email_id, ip_address, user_agent, country, city, timezone) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, ip, userAgent, country, city, timezone]
    );
  } catch (err) {
    console.error('Gagal mencatat pixel:', err.message);
  }

  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL_BUFFER.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(PIXEL_BUFFER);
});

// Route Logs
app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT email_id, ip_address, user_agent, country, city, timezone, opened_at
      FROM tracking_logs
      ORDER BY opened_at DESC
      LIMIT 20;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route Header Inspector
app.post('/api/inspect', async (req, res) => {
  const { rawHeader } = req.body;
  if (!rawHeader) return res.status(400).json({ error: 'Raw header kosong' });

  try {
    const parsed = await simpleParser(rawHeader);
    const authResults = parsed.headers.get('authentication-results') || '';

    const checkStatus = (key) => {
      const match = authResults.match(new RegExp(`${key}=(\\w+)`, 'i'));
      return match ? match[1].toLowerCase() : 'none';
    };

    const spf = checkStatus('spf');
    const dkim = checkStatus('dkim');
    const dmarc = checkStatus('dmarc');

    let riskLevel = 'SAFE';
    if (spf === 'fail' || dkim === 'fail' || dmarc === 'fail') riskLevel = 'DANGEROUS';
    else if (spf === 'none' && dmarc === 'none') riskLevel = 'WARNING';

    const insertResult = await pool.query(
      `INSERT INTO header_inspections (sender_domain, spf_status, dkim_status, dmarc_status, risk_level)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [parsed.from?.value[0]?.address?.split('@')[1] || 'unknown', spf, dkim, dmarc, riskLevel]
    );

    return res.json({
      from: parsed.from?.text,
      subject: parsed.subject,
      results: insertResult.rows[0],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Route Telemetry Ingestion
app.post('/api/telemetry', async (req, res) => {
  const { device_id, latitude, longitude, speed = 0, battery_level = 100 } = req.body;
  if (!device_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Data koordinat tidak lengkap' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO device_locations (device_id, latitude, longitude, speed, battery_level)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [device_id, latitude, longitude, speed, battery_level]
    );

    await pool.query(
      `DELETE FROM device_locations
       WHERE id IN (
         SELECT id FROM device_locations
         WHERE device_id = $1
         ORDER BY recorded_at DESC
         OFFSET 200
       )`,
      [device_id]
    );

    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route Device List
app.get('/api/devices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT device_id, MAX(recorded_at) as last_seen, COUNT(*) as total_points
      FROM device_locations
      GROUP BY device_id
      ORDER BY last_seen DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route Detail Telemetry
app.get('/api/telemetry/:device_id', async (req, res) => {
  const { device_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT latitude, longitude, speed, battery_level, recorded_at
       FROM device_locations
       WHERE device_id = $1
       ORDER BY recorded_at ASC
       LIMIT 100`,
      [device_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ekspor handler untuk serverless Vercel
export default app;