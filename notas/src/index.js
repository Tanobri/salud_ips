const Fastify = require("fastify");
const cors = require("@fastify/cors");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });

const SECRET = process.env.JWT_SECRET || "dev-secret";

// Fallback memoria
const MEM = []; // {id,citaId,autorId,S,O,A,P,createdAt}

// auth
function requireAuth(req, reply, done) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return reply.code(401).send({ message: "No token" });
  try { req.user = jwt.verify(token, SECRET); done(); }
  catch { reply.code(401).send({ message: "Invalid token" }); }
}

app.get("/health", async () => ({ ok: true, service: "notas", db: db.hasDb() ? "cosmos" : "memory" }));

// POST /citas/:id/nota
app.post("/citas/:id/nota", { preHandler: requireAuth }, async (req, reply) => {
  const { id: citaId } = req.params;
  const { S, O, A, P } = req.body || {};
  if (!S && !O && !A && !P) return reply.code(400).send({ message: "Debe enviar S/O/A/P" });

  const nota = {
    id: `n${Date.now()}`, citaId, autorId: req.user.sub,
    S: S || null, O: O || null, A: A || null, P: P || null,
    createdAt: new Date().toISOString()
  };

  if (db.hasDb()) return db.createNota(nota);
  MEM.push(nota); return nota;
});

// GET /citas/:id/nota hola
app.get("/citas/:id/nota", { preHandler: requireAuth }, async (req) => {
  const { id: citaId } = req.params;
  if (db.hasDb()) return db.listByCita(citaId);
  return MEM.filter(n => n.citaId === citaId).sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
});

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";

db.init()
  .catch(e => app.log.error(e))
  .finally(() => {
    app.listen({ port, host }).catch((err) => { app.log.error(err); process.exit(1); });
  });

