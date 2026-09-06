import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import PixelTracker from "./components/PixelTracker";
import HeaderInspector from "./components/HeaderInspector";
import DeviceMap from "./components/DeviceMap";
import MobileSender from "./components/MobileSender";

export default function App() {
  const [activeTab, setActiveTab] = useState("email-tracker");

  // Mendukung direct link dari URL query misal: /?tab=mobile-node&device=target-1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, []);

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
