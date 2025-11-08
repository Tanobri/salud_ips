// auth/src/db.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      // Azure PG suele requerir TLS; en App Service desactiva verificación de CA
      ssl: { rejectUnauthorized: false },
      // ---- TIMEOUTS CLAVE ----
      connectionTimeoutMillis: 5000, // 5s para abrir conexión
      idleTimeoutMillis: 10000,
      max: 5,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('pg pool error:', err);
  });
}

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const ALLOWED_ROLES = ['paciente', 'medico', 'admin'];
const genUserId = () => 'u' + Date.now();

async function init() {
  if (!pool) {
    console.warn('[auth] Sin conexión a DB (POSTGRES_URL/DATABASE_URL no definido).');
    return false;
  }
  try {
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
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email);`);
    console.log('[auth] PostgreSQL listo ✅');
    return true;
  } catch (e) {
    console.error('[auth] init() DB error:', e);
    return false;
  }
}

async function getUserByEmail(email) {
  if (!pool) return null;
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, rol, nombre, created_at FROM users WHERE email=$1 LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function createUser({ email, password, rol = 'paciente', nombre = 'Usuario' }) {
  if (!pool) {
    const err = new Error('DB no configurada'); err.code = 'E_NO_DB'; throw err;
  }
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






