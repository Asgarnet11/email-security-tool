import app from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;

// Jalankan listener saat di lingkungan lokal / standalone
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend Sentinel aktif di http://localhost:${PORT}`);
  });
}

export default app;
