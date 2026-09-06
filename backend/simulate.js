// Jalankan via terminal: node simulate.js
const sendCoordinate = async (lat, lng, speed, battery) => {
  try {
    const res = await fetch("http://localhost:5000/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: "device-demo",
        latitude: lat,
        longitude: lng,
        speed: speed,
        battery_level: battery,
      }),
    });
    const data = await res.json();
    console.log("Koordinat terkirim:", data.data.latitude, data.data.longitude);
  } catch (err) {
    console.error("Gagal mengirim simulasi:", err.message);
  }
};

// Simulasi pergerakan titik koordinat bertahap
let currentLat = -3.9985;
let currentLng = 122.5126;
let battery = 95;

console.log("Memulai simulasi pergerakan GPS...");
setInterval(() => {
  currentLat += (Math.random() - 0.3) * 0.001;
  currentLng += (Math.random() - 0.2) * 0.001;
  battery = Math.max(1, battery - 1);
  const speed = Math.floor(Math.random() * 40) + 10;

  sendCoordinate(currentLat, currentLng, speed, battery);
}, 3000);
