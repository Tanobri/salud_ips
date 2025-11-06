// src/db.js
const { Pool } = require("pg");

let pool = null;

// Llama a init() al arrancar la app. Si no hay POSTGRES_URL, sigue en memoria.
async function init() {
  const conn = process.env.POSTGRES_URL;
  if (!conn) {
    console.warn("[citas] POSTGRES_URL no está definido -> modo MEMORIA");
    return false;
  }
  pool = new Pool({
    connectionString: conn,
    ssl: { rejectUnauthorized: false }, // requerido en Azure PG
  });
hola
  // Crea tabla si no existe (MVP)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS citas (
      id TEXT PRIMARY KEY,
      paciente_id TEXT NOT NULL,
      medico_id   TEXT NOT NULL,
      fecha_hora  TIMESTAMPTZ NOT NULL,
      motivo      TEXT,
      estado      TEXT NOT NULL DEFAULT 'pendiente',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("[citas] PostgreSQL listo ✅");
  return true;
}

async function createCita({ id, pacienteId, medicoId, fechaHora, motivo, estado }) {
  if (!pool) throw new Error("NO_DB");
  const q = `
    INSERT INTO citas (id, paciente_id, medico_id, fecha_hora, motivo, estado)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING id, paciente_id AS "pacienteId", medico_id AS "medicoId",
              fecha_hora AS "fechaHora", motivo, estado;
  `;
  const { rows } = await pool.query(q, [id, pacienteId, medicoId, fechaHora, motivo, estado]);
  return rows[0];
}

async function listByPaciente(pacienteId) {
  if (!pool) throw new Error("NO_DB");
  const q = `
    SELECT id, paciente_id AS "pacienteId", medico_id AS "medicoId",
           fecha_hora AS "fechaHora", motivo, estado
    FROM citas
    WHERE paciente_id = $1
    ORDER BY fecha_hora DESC;
  `;
  const { rows } = await pool.query(q, [pacienteId]);
  return rows;
}


function hasDb() { return !!pool; }


module.exports = { init, createCita, listByPaciente, hasDb };


