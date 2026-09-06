import { useState, useEffect, useRef } from "react";
import {
  Navigation,
  Play,
  Square,
  Battery,
  Wifi,
  Share2,
  Copy,
  Check,
} from "lucide-react";

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
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

export default function MobileSender() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialDev =
    queryParams.get("device") ||
    `node-${Math.floor(1000 + Math.random() * 9000)}`;

  const [deviceId, setDeviceId] = useState(initialDev);
  const [isTracking, setIsTracking] = useState(false);
  const [coords, setCoords] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Standby");
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [copied, setCopied] = useState(false);

  const watchIdRef = useRef(null);
  const lastSentRef = useRef({ lat: null, lng: null, time: 0 });

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    `http://${window.location.hostname}:5000`;
  const shareableUrl = `${window.location.origin}/?tab=mobile-node&device=${deviceId}`;

  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener("levelchange", () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }
  }, []);

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendTelemetry = async (latitude, longitude, speed) => {
    try {
      const res = await fetch(`${backendUrl}/api/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          latitude,
          longitude,
          speed: speed ? Math.round(speed * 3.6) : 0,
          battery_level: batteryLevel,
        }),
      });
      if (res.ok) {
        setStatusMessage(
          `Tersimpan (${new Date().toLocaleTimeString("id-ID")})`,
        );
      } else {
        setStatusMessage("Gagal simpan ke server");
      }
    } catch {
      setStatusMessage("Gagal terhubung ke backend");
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Browser perangkat ini tidak mendukung Geolocation.");
      return;
    }

    setIsTracking(true);
    setStatusMessage("Mengunci sinyal GPS...");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy } = pos.coords;
        setCoords({ latitude, longitude, accuracy });

        const now = Date.now();
        const last = lastSentRef.current;

        const timeDiff = (now - last.time) / 1000;
        let distanceDiff = 999;
        if (last.lat !== null && last.lng !== null) {
          distanceDiff = getDistanceFromLatLonInMeters(
            last.lat,
            last.lng,
            latitude,
            longitude,
          );
        }

        if (last.lat === null || (timeDiff >= 10 && distanceDiff >= 15)) {
          lastSentRef.current = { lat: latitude, lng: longitude, time: now };
          sendTelemetry(latitude, longitude, speed);
        } else {
          setStatusMessage("Diam / Jarak < 15m (Skip DB)");
        }
      },
      (err) => {
        setStatusMessage(`GPS Error: ${err.message}`);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setStatusMessage("Pelacakan dihentikan");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 max-w-md mx-auto">
      <div>
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <Navigation size={18} className="text-indigo-400" />
          Mobile GPS Telemetry Node
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Hemat kuota: Hanya menyimpan jika berpindah minimal 15 meter.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">
            Nama / ID Perangkat:
          </label>
          <input
            type="text"
            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
            value={deviceId}
            disabled={isTracking}
            onChange={(e) => setDeviceId(e.target.value.trim())}
          />
        </div>

        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Share2 size={12} /> Tautan Node:
            </span>
            <button
              onClick={copyShareLink}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
            >
              {copied ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <Copy size={12} />
              )}
              {copied ? "Tersalin" : "Salin Link"}
            </button>
          </div>
          <p className="text-[11px] font-mono text-slate-500 break-all">
            {shareableUrl}
          </p>
        </div>

        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Battery size={14} className="text-emerald-400" /> Level Baterai
          </span>
          <span className="font-mono text-slate-200 font-semibold">
            {batteryLevel}%
          </span>
        </div>

        {coords && (
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-xs font-mono">
            <div className="text-slate-400">
              Lat:{" "}
              <span className="text-slate-200">
                {coords.latitude.toFixed(6)}
              </span>
            </div>
            <div className="text-slate-400">
              Lng:{" "}
              <span className="text-slate-200">
                {coords.longitude.toFixed(6)}
              </span>
            </div>
            <div className="text-slate-400">
              Akurasi:{" "}
              <span className="text-emerald-400">
                ±{Math.round(coords.accuracy)} meter
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Wifi
            size={14}
            className={
              isTracking ? "text-indigo-400 animate-pulse" : "text-slate-600"
            }
          />
          Status Node:{" "}
          <span className="text-slate-200 font-mono">{statusMessage}</span>
        </div>

        {!isTracking ? (
          <button
            onClick={startTracking}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
          >
            <Play size={14} /> Mulai Transmisi GPS
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition"
          >
            <Square size={14} /> Hentikan Transmisi
          </button>
        )}
      </div>
    </div>
  );
}
