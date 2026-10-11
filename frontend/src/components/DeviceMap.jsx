import { useEffect, useState, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  RefreshCw,
  Smartphone,
  Compass,
  Navigation,
  Radio,
  Gauge,
  Milestone,
} from "lucide-react";

// Rumus Haversine: Hitung jarak antar dua koordinat dalam KM
function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function MapAutoCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, map.getZoom(), { animate: true, duration: 1.2 });
    }
  }, [center, map]);
  return null;
}

const createPulseIcon = () => {
  return L.divIcon({
    className: "custom-pulse-pin",
    html: `
      <div class="relative flex items-center justify-center">
        <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-indigo-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-white shadow-[0_0_12px_rgba(99,102,241,1)]"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export default function DeviceMap() {
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? `http://${window.location.hostname}:5000`
      : window.location.origin);

  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [points, setPoints] = useState([]);
  const [autoFollow, setAutoFollow] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  const fetchDeviceList = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/devices`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setDevices(data);
        setSelectedDevice((prev) => prev || data[0].device_id);
      }
    } catch {
      // Ignored
    }
  }, [backendUrl]);

  const fetchLocations = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const res = await fetch(`${backendUrl}/api/telemetry/${selectedDevice}`);
      const data = await res.json();
      if (Array.isArray(data)) setPoints(data);
    } catch {
      // Ignored
    }
  }, [backendUrl, selectedDevice]);

  useEffect(() => {
    fetchDeviceList();
  }, [fetchDeviceList]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Real-time SSE listener untuk koordinat GPS
  useEffect(() => {
    let eventSource = null;
    try {
      eventSource = new EventSource(`${backendUrl}/api/stream`);
      eventSource.addEventListener("connected", () => {
        setSseConnected(true);
      });
      eventSource.addEventListener("new_telemetry", (event) => {
        try {
          const newPt = JSON.parse(event.data);
          if (newPt.device_id === selectedDevice) {
            setPoints((prev) => [...prev, newPt]);
          }
          fetchDeviceList();
        } catch {
          // Ignored
        }
      });
      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [backendUrl, selectedDevice, fetchDeviceList]);

  // Hitung total jarak tempuh dan kecepatan rata-rata
  const { totalDistanceKm, avgSpeed } = useMemo(() => {
    if (points.length < 2) return { totalDistanceKm: 0, avgSpeed: 0 };
    let dist = 0;
    let speedSum = 0;
    for (let i = 1; i < points.length; i++) {
      dist += getHaversineDistanceKm(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude,
      );
      speedSum += points[i].speed || 0;
    }
    return {
      totalDistanceKm: dist.toFixed(2),
      avgSpeed: Math.round(speedSum / points.length),
    };
  }, [points]);

  const polylineCoords = points.map((p) => [p.latitude, p.longitude]);
  const latestPoint = points[points.length - 1];

  const center = latestPoint
    ? [latestPoint.latitude, latestPoint.longitude]
    : [-3.9985, 122.5126];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Compass size={18} className="text-indigo-400" />
            Live Geospatial Radar
          </h2>
          <p className="text-xs text-slate-400">
            Peta telemetri satelit dengan rute presisi dan live stream koordinat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border ${
              sseConnected
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/80"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            <Radio size={11} className={sseConnected ? "animate-pulse" : ""} />
            {sseConnected ? "Live GPS Stream" : "Polling Mode"}
          </span>

          <button
            onClick={() => setAutoFollow(!autoFollow)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
              autoFollow
                ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Navigation
              size={12}
              className={autoFollow ? "text-indigo-400" : ""}
            />
            Auto-Follow: {autoFollow ? "ON" : "OFF"}
          </button>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <Smartphone size={14} className="text-indigo-400" />
            <select
              className="bg-transparent text-slate-200 focus:outline-none font-mono text-xs cursor-pointer"
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
            >
              {devices.length === 0 ? (
                <option value="">Belum ada device aktif</option>
              ) : (
                devices.map((d) => (
                  <option
                    key={d.device_id}
                    value={d.device_id}
                    className="bg-slate-900 text-slate-200"
                  >
                    {d.device_id} ({d.total_points} titik)
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={() => {
              fetchDeviceList();
              fetchLocations();
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            title="Refresh Map"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Rincian Telemetri & Statistik Perjalanan */}
      {latestPoint && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 font-mono text-slate-300">
          <div className="flex items-center gap-3">
            <span className="text-indigo-400 font-bold">{selectedDevice}</span>
            <span>Lat: {latestPoint.latitude.toFixed(6)}</span>
            <span>Lng: {latestPoint.longitude.toFixed(6)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 text-slate-400">
            <span className="flex items-center gap-1 text-indigo-300">
              <Milestone size={12} /> Jarak: {totalDistanceKm} km
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <Gauge size={12} /> Kec: {latestPoint.speed} km/h (Avg {avgSpeed})
            </span>
            <span className="text-emerald-400 font-semibold">
              Bat: {latestPoint.battery_level}%
            </span>
          </div>
        </div>
      )}

      <div className="h-96 w-full rounded-xl overflow-hidden border border-slate-800 relative z-0 shadow-inner">
        <MapContainer
          center={center}
          zoom={15}
          style={{ height: "100%", width: "100%", backgroundColor: "#0f172a" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {autoFollow && latestPoint && (
            <MapAutoCenter
              center={[latestPoint.latitude, latestPoint.longitude]}
            />
          )}

          {polylineCoords.length > 0 && (
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: "#818cf8",
                weight: 4,
                opacity: 0.85,
                lineJoin: "round",
                dashArray: "2, 6",
              }}
            />
          )}

          {latestPoint && (
            <Marker
              position={[latestPoint.latitude, latestPoint.longitude]}
              icon={createPulseIcon()}
            >
              <Popup className="custom-dark-popup">
                <div className="text-xs font-sans text-slate-800 p-1">
                  <p className="font-bold text-indigo-600 mb-0.5">
                    {selectedDevice}
                  </p>
                  <p>Kecepatan: {latestPoint.speed} km/h</p>
                  <p>Baterai: {latestPoint.battery_level}%</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {new Date(latestPoint.recorded_at).toLocaleTimeString(
                      "id-ID",
                    )}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
