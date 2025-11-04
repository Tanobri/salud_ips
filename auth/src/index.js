const Fastify = require("fastify");
const cors = require("@fastify/cors");
const jwt = require("jsonwebtoken");

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });

const SECRET = process.env.JWT_SECRET || "dev-secret";

const USERS = [
  { id: "u1", email: "paciente@ips.com", password: "123456", rol: "paciente", nombre: "Paciente Demo" },
  { id: "m1", email: "medico@ips.com",   password: "123456", rol: "medico",   nombre: "Médico Demo" },
];

// --- helper para proteger rutas ---
function requireAuth(req, reply, done) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return reply.code(401).send({ message: "No token" });
  try {
    req.user = jwt.verify(token, SECRET); // { sub, rol, iat, exp }
    done();
  } catch {
    reply.code(401).send({ message: "Invalid token" });
  }
}

// healthcheck
app.get("/health", async () => ({ ok: true, service: "auth" }));

// login
app.post("/login", async (req, reply) => {
  const { email, password } = req.body || {};
  const user = USERS.find((u) => u.email === email);
  if (!user || user.password !== password) {
    return reply.code(401).send({ message: "Credenciales inválidas" });
  }
  const accessToken = jwt.sign({ sub: user.id, rol: user.rol }, SECRET, { expiresIn: "2h" });
  return { accessToken, user: { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre } };
});

// --- nueva ruta protegida ---
app.get("/me", { preHandler: requireAuth }, async (req) => {
  const user = USERS.find((u) => u.id === req.user.sub);
  return { user: { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre } };
});

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";
app.listen({ port, host }).catch((err) => { app.log.error(err); process.exit(1); });


