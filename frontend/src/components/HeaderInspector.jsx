import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, Search } from "lucide-react";

export default function HeaderInspector() {
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    `http://${window.location.hostname}:5000`;

  const [rawHeader, setRawHeader] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeHeader = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawHeader }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      alert("Gagal terhubung ke backend server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-200">
          Audit Keaslian Header (Anti-Phishing)
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Tempelkan <i>Raw RFC 822 Header</i> dari klien email untuk memvalidasi
          SPF, DKIM, dan DMARC.
        </p>
      </div>

      <textarea
        rows="6"
        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        placeholder="Delivered-To: ...&#10;Received: ...&#10;Authentication-Results: ..."
        value={rawHeader}
        onChange={(e) => setRawHeader(e.target.value)}
      />

      <button
        onClick={analyzeHeader}
        disabled={loading || !rawHeader.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
      >
        <Search size={14} />
        {loading ? "Menganalisis..." : "Periksa Header"}
      </button>

      {result && (
        <div className="mt-4 border border-slate-800 rounded-xl bg-slate-950 p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <span className="text-xs font-medium text-slate-300">
              Hasil Evaluasi:
            </span>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                result.results.risk_level === "SAFE"
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : result.results.risk_level === "WARNING"
                    ? "bg-amber-950 text-amber-400 border border-amber-800"
                    : "bg-rose-950 text-rose-400 border border-rose-800"
              }`}
            >
              {result.results.risk_level === "SAFE" && (
                <ShieldCheck size={12} />
              )}
              {result.results.risk_level === "WARNING" && (
                <ShieldAlert size={12} />
              )}
              {result.results.risk_level === "DANGEROUS" && (
                <ShieldX size={12} />
              )}
              {result.results.risk_level}
            </span>
          </div>

          <div className="space-y-1 text-xs text-slate-300">
            <p>
              <strong className="text-slate-500">From:</strong> {result.from}
            </p>
            <p>
              <strong className="text-slate-500">Subject:</strong>{" "}
              {result.subject}
            </p>
            <p>
              <strong className="text-slate-500">Sender Domain:</strong>{" "}
              {result.results.sender_domain}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {["spf", "dkim", "dmarc"].map((protocol) => {
              const val = result.results[`${protocol}_status`];
              return (
                <div
                  key={protocol}
                  className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-center"
                >
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                    {protocol}
                  </span>
                  <span
                    className={`text-xs font-bold uppercase mt-1 inline-block ${
                      val === "pass"
                        ? "text-emerald-400"
                        : val === "fail"
                          ? "text-rose-400"
                          : "text-slate-400"
                    }`}
                  >
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
