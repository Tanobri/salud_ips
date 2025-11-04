const Fastify = require("fastify");
const cors = require("@fastify/cors");
const jwt = require("jsonwebtoken");

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });

const SECRET = process.env.JWT_SECRET || "dev-secret";

// memoria MVP
// cada item: { id, citaId, autorId, S, O, A, P, createdAt }
const NOTAS = [];

// auth middleware
function requireAuth(req, reply, done) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return reply.code(401).send({ message: "No token" });
  try {
    req.user = jwt.verify(token, SECRET); // { sub, rol }
    done();
  } catch {
    reply.code(401).send({ message: "Invalid token" });
  }
}

// health
app.get("/health", async () => ({ ok: true, service: "notas" }));

// POST /citas/:id/nota  -> crea/añade nota SOAP
app.post("/citas/:id/nota", { preHandler: requireAuth }, async (req, reply) => {
  const { id: citaId } = req.params;
  const { S, O, A, P } = req.body || {};
  if (!S && !O && !A && !P) {
    return reply.code(400).send({ message: "Debe enviar al menos un campo de la nota (S,O,A,P)" });
  }
  const nota = {
    id: `n${Date.now()}`,
    citaId,
    autorId: req.user.sub,
    S: S || null, O: O || null, A: A || null, P: P || null,
    createdAt: new Date().toISOString()
  };
  NOTAS.push(nota);
  return nota;
});

// GET /citas/:id/nota  -> lista notas de la cita
app.get("/citas/:id/nota", { preHandler: requireAuth }, async (req) => {
  const { id: citaId } = req.params;
  return NOTAS.filter(n => n.citaId === citaId);
});

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";
app.listen({ port, host }).catch((err) => { app.log.error(err); process.exit(1); });
