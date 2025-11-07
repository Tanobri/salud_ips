// auth/src/index.js
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // <-- usa bcryptjs en toda la app

const { init, getUserByEmail, createUser, pool } = require('./db');

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const signToken = (u) =>
  jwt.sign(
    { sub: u.id, email: u.email, rol: u.rol, nombre: u.nombre },
    SECRET,
    { expiresIn: '8h' }
  );

app.get('/health', async () => ({
  ok: true,
  service: 'auth',
  db: pool ? 'postgres' : 'none',
}));

app.post('/auth/register', async (req, reply) => {
  try {
    const { email, password, rol = 'paciente', nombre = 'Usuario' } = req.body || {};
    if (!email || !password) {
      return reply.code(400).send({ message: 'email y password son obligatorios' });
    }
    const user = await createUser({ email, password, rol, nombre });
    const accessToken = signToken(user);
    return reply.code(201).send({ user, accessToken });
  } catch (err) {
    if (err.code === 'E_DUP_EMAIL') return reply.code(409).send({ message: 'Email ya registrado' });
    if (err.code === 'E_BAD_ROLE')  return reply.code(400).send({ message: 'Rol inválido (use: paciente|medico|admin)' });
    req.log.error(err);
    return reply.code(500).send({ message: 'Error registrando usuario' });
  }
});

app.post('/login', async (req, reply) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return reply.code(400).send({ message: 'email y password son obligatorios' });

    const user = await getUserByEmail(email);
    if (!user) return reply.code(401).send({ message: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return reply.code(401).send({ message: 'Credenciales inválidas' });

    const { password_hash, ...pub } = user;
    const accessToken = signToken(pub);
    return { accessToken, user: pub };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ message: 'Error en login' });
  }
});

// Arranca SIEMPRE el server; init corre en background (no tumba el contenedor)
app.listen({ port: PORT, host: HOST })
  .then(async () => {
    app.log.info(`Auth up on http://${HOST}:${PORT}`);
    try {
      await init();
      app.log.info('DB init done ✅');
    } catch (e) {
      app.log.error({ err: e }, 'DB init failed (app sigue arriba)');
    }
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });







