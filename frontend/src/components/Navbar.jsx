import { ShieldCheck, Navigation, Mail, Smartphone } from "lucide-react";

export default function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "email-tracker", label: "Email Tracking", icon: Mail },
    { id: "header-inspector", label: "Header Inspector", icon: ShieldCheck },
    { id: "device-map", label: "Device GPS", icon: Navigation },
    { id: "mobile-node", label: "Mobile Node", icon: Smartphone },
  ];

  return (
    <header className="border-b border-slate-800 pb-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <ShieldCheck size={20} />
            </span>
            Security & Telemetry Sentinel
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Analisis keamanan email, pemantauan pembacaan pesan, dan telemetri
            perangkat.
          </p>
        </div>

        <nav className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
