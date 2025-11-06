const Fastify = require("fastify");
const cors = require("@fastify/cors");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });

const SECRET = process.env.JWT_SECRET || "dev-secret";

// Fallback memoria si no hay BD
const MEM = [];

// auth middleware
function requireAuth(req, reply, done) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return reply.code(401).send({ message: "No token" });
  try { req.user = jwt.verify(token, SECRET); done(); }
  catch { reply.code(401).send({ message: "Invalid token" }); }
}

app.get("/health", async () => ({ ok: true, service: "citas", db: db.hasDb() ? "postgres" : "memory" }));

// crear cita
app.post("/citas", { preHandler: requireAuth }, async (req, reply) => {
  const { medicoId, fechaHora, motivo } = req.body || {};
  if (!medicoId || !fechaHora) return reply.code(400).send({ message: "medicoId y fechaHora son requeridos" });

  const cita = {
    id: `c${Date.now()}`,
    pacienteId: req.user.sub,
    medicoId,
    fechaHora,
    motivo: motivo || null,
    estado: "pendiente",
  };

  if (db.hasDb()) {
    const saved = await db.createCita(cita);
    return saved;
  } else {
    MEM.push(cita);
    return cita;
  }
});

// listar mis citas
app.get("/citas", { preHandler: requireAuth }, async (req) => {
  if (db.hasDb()) return db.listByPaciente(req.user.sub);
  return MEM.filter(c => c.pacienteId === req.user.sub);
});

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";



// Inicializa BD y arranca
db.init()
  .catch((e) => { app.log.error(e); })
  .finally(() => {
    app.listen({ port, host }).catch((err) => { app.log.error(err); process.exit(1); });
  });


