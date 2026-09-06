import { useEffect, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { RefreshCw, Smartphone, Compass, Navigation } from "lucide-react";

function MapAutoCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, map.getZoom(), { animate: true, duration: 1.5 });
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
    `http://${window.location.hostname}:5000`;

  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [points, setPoints] = useState([]);
  const [autoFollow, setAutoFollow] = useState(true);

  const fetchDeviceList = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/devices`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setDevices(data);
        if (!selectedDevice) {
          setSelectedDevice(data[0].device_id);
        }
      }
    } catch {
      // Ignored
    }
  }, [backendUrl, selectedDevice]);

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
    const interval = setInterval(fetchLocations, 4000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

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
            Peta telemetri satelit dengan rute presisi.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {latestPoint && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-950/80 p-3 rounded-lg border border-slate-800 font-mono text-slate-300">
          <div className="flex items-center gap-3">
            <span className="text-indigo-400 font-bold">{selectedDevice}</span>
            <span>Lat: {latestPoint.latitude.toFixed(6)}</span>
            <span>Lng: {latestPoint.longitude.toFixed(6)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-semibold">
              Bat: {latestPoint.battery_level}%
            </span>
            <span>Kec: {latestPoint.speed} km/h</span>
            <span className="text-slate-500">
              {new Date(latestPoint.recorded_at).toLocaleTimeString("id-ID")}
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
