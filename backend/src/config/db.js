import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : {
        rejectUnauthorized: false,
      },
});

pool.on("error", (err) => {
  console.error("⚠️ PostgreSQL Pool Error:", err.message);
});

export const query = async (text, params) => {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL belum dikonfigurasi. Query diabaikan:", text.slice(0, 50));
    return { rows: [] };
  }
  return pool.query(text, params);
};
