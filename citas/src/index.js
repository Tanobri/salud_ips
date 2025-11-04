const Fastify = require("fastify");
const cors = require("@fastify/cors");
const jwt = require("jsonwebtoken");

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });

const SECRET = process.env.JWT_SECRET || "dev-secret";

// almacenamiento en memoria (MVP)
const CITAS = []; // { id, pacienteId, medicoId, fechaHora, motivo, estado }

// middleware simple de auth
function requireAuth(req, reply, done) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return reply.code(401).send({ message: "No token" });
  try {
    req.user = jwt.verify(token, SECRET); // { sub, rol, ... }
    done();
  } catch {
    reply.code(401).send({ message: "Invalid token" });
  }
}

// health
app.get("/health", async () => ({ ok: true, service: "citas" }));

// POST /citas  (protegido)  -> crea una cita
app.post("/citas", { preHandler: requireAuth }, async (req, reply) => {
  const { medicoId, fechaHora, motivo } = req.body || {};
  if (!medicoId || !fechaHora) {
    return reply.code(400).send({ message: "medicoId y fechaHora son requeridos" });
  }
  const cita = {
    id: `c${Date.now()}`,
    pacienteId: req.user.sub,
    medicoId,
    fechaHora,   // ISO string
    motivo: motivo || null,
    estado: "pendiente",
  };
  CITAS.push(cita);
  return cita;
});

// GET /citas (protegido) -> lista las citas del usuario autenticado
app.get("/citas", { preHandler: requireAuth }, async (req) => {
  const mine = CITAS.filter(c => c.pacienteId === req.user.sub);
  return mine;
});

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";
app.listen({ port, host }).catch((err) => { app.log.error(err); process.exit(1); });

