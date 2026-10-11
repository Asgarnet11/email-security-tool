import { query } from "../config/db.js";
import { broadcast } from "../services/broadcaster.js";

// 1. Ingestion Koordinat Perangkat GPS (dengan Auto-Pruning 200 titik)
export const handleIngestTelemetry = async (req, res) => {
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

  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);

  if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ error: "Koordinat latitude atau longitude tidak valid" });
  }

  const speedNum = Math.max(0, parseInt(speed, 10) || 0);
  const batteryNum = Math.min(100, Math.max(0, parseInt(battery_level, 10) || 100));

  try {
    const insertQuery = `
      INSERT INTO device_locations (device_id, latitude, longitude, speed, battery_level)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await query(insertQuery, [
      device_id,
      latNum,
      lngNum,
      speedNum,
      batteryNum,
    ]);

    const savedPoint = result.rows[0] || {
      device_id,
      latitude: latNum,
      longitude: lngNum,
      speed: speedNum,
      battery_level: batteryNum,
      recorded_at: new Date().toISOString(),
    };

    // Bersihkan data berlebih: hanya simpan 200 titik terbaru per perangkat
    await query(
      `DELETE FROM device_locations
       WHERE id IN (
         SELECT id FROM device_locations
         WHERE device_id = $1
         ORDER BY recorded_at DESC
         OFFSET 200
       )`,
      [device_id],
    );

    // Broadcast ke peta real-time via SSE
    broadcast("new_telemetry", savedPoint);

    res.status(201).json({ status: "success", data: savedPoint });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan telemetri: " + err.message });
  }
};

// 2. Ambil Daftar Semua Perangkat Terdaftar
export const handleGetDevices = async (req, res) => {
  try {
    const result = await query(`
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
    res.status(500).json({ error: "Gagal mengambil daftar device: " + err.message });
  }
};

// 3. Ambil Riwayat Koordinat Perangkat Tertentu
export const handleGetDeviceTelemetry = async (req, res) => {
  const { device_id } = req.params;
  try {
    const result = await query(
      `SELECT latitude, longitude, speed, battery_level, recorded_at
       FROM device_locations
       WHERE device_id = $1
       ORDER BY recorded_at ASC
       LIMIT 100`,
      [device_id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data rute peta: " + err.message });
  }
};
