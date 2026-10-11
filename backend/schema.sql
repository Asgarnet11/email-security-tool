-- ========================================================
-- Schema Database: Security & Telemetry Sentinel
-- PostgreSQL Initialization Script
-- ========================================================

-- 1. Tabel Log Pembukaan Email (Tracking Pixel)
CREATE TABLE IF NOT EXISTS tracking_logs (
    id SERIAL PRIMARY KEY,
    email_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    timezone VARCHAR(100),
    is_proxy BOOLEAN DEFAULT FALSE,
    client_type VARCHAR(50) DEFAULT 'Direct Client',
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_logs_email_id ON tracking_logs(email_id);
CREATE INDEX IF NOT EXISTS idx_tracking_logs_opened_at ON tracking_logs(opened_at DESC);

-- 2. Tabel Audit Keaslian Email (Anti-Phishing Header Inspector)
CREATE TABLE IF NOT EXISTS header_inspections (
    id SERIAL PRIMARY KEY,
    sender_domain VARCHAR(255),
    display_name VARCHAR(255),
    spf_status VARCHAR(50),
    dkim_status VARCHAR(50),
    dmarc_status VARCHAR(50),
    risk_level VARCHAR(50),
    risk_score INTEGER DEFAULT 0,
    details JSONB,
    inspected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_header_inspections_inspected_at ON header_inspections(inspected_at DESC);

-- 3. Tabel Telemetri Lokasi Perangkat (GPS Tracking)
CREATE TABLE IF NOT EXISTS device_locations (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed NUMERIC DEFAULT 0,
    battery_level NUMERIC DEFAULT 100,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_locations_device_id_recorded_at 
ON device_locations(device_id, recorded_at DESC);
