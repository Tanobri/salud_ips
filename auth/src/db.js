// src/db.js
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
let pool = null;

async function init() {
  const url = process.env.POSTGRES_URL;
  if (!url) { console.warn("[auth] POSTGRES_URL no definido -> modo MEMORIA"); return false; }
  pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT,
      password_hash TEXT NOT NULL
    );
  `);

  // seed de usuario demo (solo si no existe)
  const email = "paciente@ips.com";
  const hash = await bcrypt.hash("123456", 10);
  await pool.query(`
    INSERT INTO users (id, email, name, role, password_hash)
    VALUES ('u1', $1, 'Paciente Demo', 'paciente', $2)
    ON CONFLICT (email) DO NOTHING;
  `, [email, hash]);

  console.log("[auth] PostgreSQL listo ✅");
  return true;
}

async function findByEmail(email) {
  if (!pool) throw new Error("NO_DB");
  const { rows } = await pool.query(
    `SELECT id, email, name, role, password_hash FROM users WHERE email=$1`,
    [email]
  );
  return rows[0] || null;
}

function hasDb() { return !!pool; }
module.exports = { init, findByEmail, hasDb };
