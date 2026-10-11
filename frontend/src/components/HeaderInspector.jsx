import { useState, useRef } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Search,
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
} from "lucide-react";

// Contoh Header untuk Pengujian Instan
const SAMPLE_PHISHING_HEADER = `Delivered-To: victim@company.com
Received: by 2002:a05:6512:493:b0:538:39e:7c55 with SMTP id n19csp638133lfb;
Authentication-Results: mx.google.com;
       spf=fail (google.com: domain of support@paypal-verification-alert.com does not designate 198.51.100.42 as permitted sender) smtp.mailfrom=support@paypal-verification-alert.com;
       dkim=fail header.i=@paypal-verification-alert.com;
       dmarc=fail (p=REJECT sp=REJECT dis=NONE) header.from=paypal.com
From: "PayPal Security Support" <security-alerts@paypal-suspicious-alert.com>
Reply-To: phisher-collector@anonymous-mail.org
Subject: [URGENT] Account Suspended - Action Required Immediately!
Date: Fri, 10 Oct 2026 14:22:10 +0000`;

const SAMPLE_SAFE_HEADER = `Delivered-To: user@example.com
Received: by 2002:a05:6512:493:b0:538:39e:7c55 with SMTP id n19csp638133lfb;
Authentication-Results: mx.google.com;
       spf=pass (google.com: domain of notifications@github.com designates 192.30.252.204 as permitted sender) smtp.mailfrom=notifications@github.com;
       dkim=pass header.i=@github.com;
       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=github.com
From: "GitHub Notifications" <notifications@github.com>
Subject: [GitHub] Security advisory alert: dependencies updated
Date: Fri, 10 Oct 2026 09:15:00 +0000`;

export default function HeaderInspector() {
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? `http://${window.location.hostname}:5000`
      : window.location.origin);

  const [rawHeader, setRawHeader] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setRawHeader(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const analyzeHeader = async () => {
    if (!rawHeader.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawHeader }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        alert(data.error || "Gagal menganalisis header");
      }
    } catch {
      alert("Gagal terhubung ke backend server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-400" />
            Audit Keaslian Header (Anti-Phishing & Spoofing Inspector)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tempelkan <i>Raw RFC 822 Header</i> atau unggah berkas <code>.eml</code> untuk memvalidasi SPF, DKIM, DMARC, serta anomali pengirim.
          </p>
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRawHeader(SAMPLE_SAFE_HEADER)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-emerald-300 rounded-lg border border-slate-700 transition"
          >
            Contoh Valid
          </button>
          <button
            type="button"
            onClick={() => setRawHeader(SAMPLE_PHISHING_HEADER)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-rose-300 rounded-lg border border-slate-700 transition"
          >
            Contoh Phishing
          </button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-4 text-center transition cursor-pointer ${
          isDragging
            ? "border-indigo-500 bg-indigo-950/20"
            : "border-slate-800 hover:border-slate-700 bg-slate-950/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".eml,.txt,.msg"
          onChange={(e) => handleFileUpload(e.target.files?.[0])}
        />
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <UploadCloud size={16} className="text-indigo-400" />
          <span>Tarik file <code>.eml</code> ke sini, atau klik untuk memilih file</span>
        </div>
      </div>

      <div className="relative">
        <textarea
          rows={6}
          className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600 leading-relaxed"
          placeholder="Delivered-To: ...&#10;Received: ...&#10;Authentication-Results: ...&#10;From: ...&#10;Subject: ..."
          value={rawHeader}
          onChange={(e) => setRawHeader(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={analyzeHeader}
          disabled={loading || !rawHeader.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
        >
          <Search size={14} />
          {loading ? "Membedah Header..." : "Periksa & Analisis Header"}
        </button>

        {rawHeader && (
          <button
            onClick={() => {
              setRawHeader("");
              setResult(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-300 transition"
          >
            Bersihkan Input
          </button>
        )}
      </div>

      {result && (
        <div className="mt-6 border border-slate-800 rounded-xl bg-slate-950 p-6 space-y-5 animate-in fade-in duration-300">
          {/* Header Summary & Risk Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
            <div>
              <span className="text-xs text-slate-400 font-medium">Status Keamanan Email:</span>
              <h3 className="text-sm font-semibold text-white mt-0.5">
                {result.subject || "(Tanpa Subjek)"}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  result.results?.risk_level === "SAFE"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : result.results?.risk_level === "WARNING"
                    ? "bg-amber-950 text-amber-400 border border-amber-800"
                    : "bg-rose-950 text-rose-400 border border-rose-800"
                }`}
              >
                {result.results?.risk_level === "SAFE" && <ShieldCheck size={14} />}
                {result.results?.risk_level === "WARNING" && <ShieldAlert size={14} />}
                {result.results?.risk_level === "DANGEROUS" && <ShieldX size={14} />}
                {result.results?.risk_level || "UNKNOWN"}
              </span>

              {result.results?.risk_score !== undefined && (
                <span className="text-xs font-mono px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
                  Skor Risiko: <b className="text-indigo-400">{result.results.risk_score}/100</b>
                </span>
              )}
            </div>
          </div>

          {/* Pengirim & Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-900/40 p-4 rounded-lg border border-slate-800/60 font-mono">
            <div>
              <span className="text-slate-500 block text-[11px]">Display Name / Alamat Asli:</span>
              <span className="text-slate-200 font-medium">{result.from || "Unknown"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Sender Domain Terverifikasi:</span>
              <span className="text-indigo-300 font-bold">{result.results?.sender_domain || "Unknown"}</span>
            </div>
          </div>

          {/* Protocol Badges (SPF, DKIM, DMARC) */}
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-2">
              Validasi Protokol Kriptografi & Kebijakan:
            </span>
            <div className="grid grid-cols-3 gap-3">
              {["spf", "dkim", "dmarc"].map((protocol) => {
                const val = result.results?.[`${protocol}_status`] || "none";
                const isPass = val === "pass";
                const isFail = val === "fail";
                return (
                  <div
                    key={protocol}
                    className="p-3 bg-slate-900/70 border border-slate-800 rounded-lg text-center"
                  >
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {protocol}
                    </span>
                    <span
                      className={`text-xs font-black uppercase mt-1 inline-flex items-center gap-1 ${
                        isPass
                          ? "text-emerald-400"
                          : isFail
                          ? "text-rose-400"
                          : "text-amber-400"
                      }`}
                    >
                      {isPass && <CheckCircle2 size={12} />}
                      {isFail && <AlertTriangle size={12} />}
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rincian Analisis Keamanan (Security Advisory) */}
          {result.details && result.details.length > 0 && (
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-400" />
                Catatan Temuan Forensik Email:
              </span>
              <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
                {result.details.map((item, idx) => (
                  <li key={idx} className={item.isWarning ? "text-rose-300" : "text-slate-300"}>
                    {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
