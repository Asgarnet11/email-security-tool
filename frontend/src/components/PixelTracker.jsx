import { useState, useEffect } from "react";
import { Copy, Check, Eye, RefreshCw } from "lucide-react";

export default function PixelTracker() {
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    `http://${window.location.hostname}:5000`;

  const [trackerId, setTrackerId] = useState("");
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/logs`);
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch (err) {
      console.error("Gagal mengambil logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/logs`);
        const data = await res.json();
        if (isMounted && Array.isArray(data)) setLogs(data);
      } catch {
        // Ignored
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [backendUrl]);

  const generateNewId = () => {
    setTrackerId(crypto.randomUUID());
    setCopied(false);
  };

  const pixelTag = trackerId
    ? `<img src="${backendUrl}/track/px/${trackerId}.gif" width="1" height="1" alt="" style="display:none;" />`
    : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pixelTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Generator Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-200">
            Generator Tracking Pixel
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Buat tag HTML 1x1 piksel untuk disisipkan ke bodi email sebelum
            dikirim.
          </p>
        </div>

        <button
          onClick={generateNewId}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
        >
          Buat ID Pelacak Baru
        </button>

        {trackerId && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
              <code className="text-xs text-indigo-300 font-mono break-all">
                {pixelTag}
              </code>
              <button
                onClick={copyToClipboard}
                className="ml-3 p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition"
                title="Salin"
              >
                {copied ? (
                  <Check size={14} className="text-emerald-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              UUID Aktif:{" "}
              <span className="font-mono text-slate-400">{trackerId}</span>
            </p>
          </div>
        )}
      </div>

      {/* Logs Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <Eye size={16} className="text-indigo-400" /> Log Email Terbuka
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Penerima yang memicu pemuatan gambar pixel dari server.
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={logsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs rounded-lg text-slate-300 transition"
          >
            <RefreshCw
              size={12}
              className={logsLoading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">ID Email</th>
                <th className="px-4 py-3">Lokasi</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">User-Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Belum ada pembukaan email yang tercatat.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono">
                      {new Date(log.opened_at).toLocaleString("id-ID")}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-indigo-400 max-w-30 truncate"
                      title={log.email_id}
                    >
                      {log.email_id}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      <span className="font-medium text-emerald-400">
                        {log.city || "Unknown"}
                      </span>
                      , {log.country || "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {log.ip_address}
                    </td>
                    <td
                      className="px-4 py-3 max-w-50 truncate text-slate-400"
                      title={log.user_agent}
                    >
                      {log.user_agent}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
