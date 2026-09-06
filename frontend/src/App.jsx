import { useState } from "react";
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

  // Mode Target / Klien (Halaman Bersih Tanpa Navbar)
  if (isClientMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
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
