const Fastify = require("fastify");
const cors = require("@fastify/cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });

const SECRET = process.env.JWT_SECRET || "dev-secret";

app.get("/health", async () => ({
  ok: true,
  service: "auth",
  db: db.hasDb() ? "postgres" : "memory",
}));

app.post("/login", async (req, reply) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return reply.code(400).send({ message: "email y password requeridos" });
  }

  // Con BD
  if (db.hasDb()) {
    const u = await db.findByEmail(email); // debe devolver: { id, email, password_hash, rol, nombre }
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return reply.code(401).send({ message: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { sub: u.id, email: u.email, rol: u.rol, nombre: u.nombre },
      SECRET,
      { expiresIn: "1h" }
    );

    return { accessToken: token, user: { id: u.id, email: u.email, rol: u.rol, nombre: u.nombre } };
  }

  // Fallback en memoria
  if (email === "paciente@ips.com" && password === "123456") {
    const user = { id: "u1", email, rol: "paciente", nombre: "Paciente Demo" };
    const token = jwt.sign(
      { sub: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
      SECRET,
      { expiresIn: "1h" }
    );
    return { accessToken: token, user };
  }

  return reply.code(401).send({ message: "Credenciales inválidas" });
});

// NUEVA RUTA: /me
app.get("/me", async (req, reply) => {
  try {
    const auth = req.headers.authorization || "";
    const [scheme, token] = auth.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return reply.code(401).send({ message: "Token requerido" });
    }

    const payload = jwt.verify(token, SECRET); // { sub, email, rol, nombre }

    // Por defecto, toma lo del token
    let user = {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
      nombre: payload.nombre,
    };

    // Si hay BD, refresca por id (opcional)
    if (db.hasDb() && typeof db.findById === "function") {
      const u = await db.findById(payload.sub); // espera { id, email, rol, nombre }
      if (u) {
        user = { id: u.id, email: u.email, rol: u.rol, nombre: u.nombre };
      }
    }

    return { user };
  } catch (err) {
    req.log.error(err);
    return reply.code(401).send({ message: "Token inválido" });
  }
});

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";

db.init()
  .catch((e) => app.log.error(e))
  .finally(() => {
    app.listen({ port, host }).catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
  });




