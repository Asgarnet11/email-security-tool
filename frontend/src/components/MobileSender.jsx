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

// Rumus Haversine: Hitung selisih jarak dalam satuan meter antara 2 titik koordinat
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius bumi dalam meter
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

export default function MobileSender({ isStandalone = false }) {
  // Lazy initial state: Math.random() hanya dipanggil 1 kali saat inisialisasi awal
  const [deviceId, setDeviceId] = useState(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const paramDev = queryParams.get("device");
    if (paramDev) return paramDev;
    return `node-${Math.floor(1000 + Math.random() * 9000)}`;
  });

  const [isTracking, setIsTracking] = useState(false);
  const [coords, setCoords] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Standby");
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [copied, setCopied] = useState(false);

  const watchIdRef = useRef(null);
  const lastSentRef = useRef({ lat: null, lng: null, time: 0 });

  // Deteksi URL backend otomatis (lokal port 5000 vs cloud production)
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
      ? `http://${window.location.hostname}:5000`
      : typeof window !== "undefined"
        ? window.location.origin
        : "");

  const shareableUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?tab=track&device=${deviceId}`
      : "";

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
          speed: speed ? Math.round(speed * 3.6) : 0, // Konversi m/s ke km/jam
          battery_level: batteryLevel,
        }),
      });
      if (res.ok) {
        setStatusMessage(
          `Terkirim (${new Date().toLocaleTimeString("id-ID")})`,
        );
      } else {
        setStatusMessage("Gagal simpan ke server");
      }
    } catch {
      setStatusMessage("Koneksi server terputus");
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

        // FILTER: Minimal 10 detik ATAU berpindah posisi lebih dari 15 meter
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
          setStatusMessage("Diam / Selisih < 15m (Skip)");
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
      {isStandalone ? (
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-600/20 text-indigo-400 rounded-full border border-indigo-500/30">
            <Navigation size={24} />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">
            Berbagi Lokasi Langsung
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Perangkat{" "}
            <span className="font-mono text-indigo-300 font-semibold">
              {deviceId}
            </span>{" "}
            meminta izin transmisi telemetri GPS secara real-time.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Navigation size={18} className="text-indigo-400" />
            Mobile GPS Telemetry Node
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gunakan modul ini untuk menguji transmisi koordinat dari browser
            perangkat.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {!isStandalone && (
          <>
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
                <span className="flex items-center gap-1.5 leading-none">
                  <Share2 size={12} /> Link Khusus Target:
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
                  {copied ? "Tersalin" : "Salin"}
                </button>
              </div>
              <p className="text-[11px] font-mono text-slate-500 break-all">
                {shareableUrl}
              </p>
            </div>
          </>
        )}

        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Battery size={14} className="text-emerald-400" /> Daya Baterai
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

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
          <Wifi
            size={14}
            className={
              isTracking ? "text-emerald-400 animate-pulse" : "text-slate-600"
            }
          />
          Status:{" "}
          <span className="text-slate-200 font-mono">{statusMessage}</span>
        </div>

        {!isTracking ? (
          <button
            onClick={startTracking}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-indigo-600/20"
          >
            <Play size={16} /> Izinkan & Mulai Berbagi Lokasi
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition"
          >
            <Square size={16} /> Hentikan Berbagi Lokasi
          </button>
        )}
      </div>
    </div>
  );
}
