// auth/src/db.js
const { Pool } = require('pg');
const bcrypt = require('bcrypt'); // usas bcryptjs en package.json

// Azure PostgreSQL exige TLS
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const ALLOWED_ROLES = ['paciente', 'medico', 'admin'];
const genUserId = () => 'u' + Date.now();

async function init() {
  if (!process.env.POSTGRES_URL) {
    console.warn('[auth] POSTGRES_URL no definido -> sin DB');
    return false;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL,
      nombre TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  //idempotente: crea la constraint única si no existe
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_email'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
      END IF;
    END
    $$;
  `);

  console.log('[auth] PostgreSQL listo ✅');
  return true;
}

async function getUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, rol, nombre, created_at FROM users WHERE email=$1 LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function createUser({ email, password, rol = 'paciente', nombre = 'Usuario' }) {
  if (!ALLOWED_ROLES.includes(rol)) {
    const err = new Error('Rol inválido'); err.code = 'E_BAD_ROLE'; throw err;
  }

  const exists = await getUserByEmail(email);
  if (exists) {
    const err = new Error('Email ya registrado'); err.code = 'E_DUP_EMAIL'; throw err;
  }

  const password_hash = await bcrypt.hash(password, ROUNDS);
  const id = genUserId();

  const { rows } = await pool.query(
    `INSERT INTO users (id, email, password_hash, rol, nombre)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, email, rol, nombre, created_at`,
    [id, email, password_hash, rol, nombre]
  );

  return rows[0];
}

module.exports = { init, getUserByEmail, createUser, pool };




