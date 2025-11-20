// auth/src/index.js
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { init, getUserByEmail, createUser, pool } = require('./db');

const app = Fastify({ logger: true });
app.register(cors, { origin: true, credentials: true });

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

// ======================================================
// Helpers de tokens
// ======================================================

// 🔐 Token de sesión (para citas / notas / portal)
const signAccessToken = (u) =>
  jwt.sign(
    {
      sub: u.id,
      email: u.email,
      rol: u.rol,
      nombre: u.nombre,
      kind: 'access', // tipo de token: acceso normal
    },
    SECRET,
    { expiresIn: '8h' } // igual que antes
  );

// 🔐 Token de registro (solo confirma alta, NO se usa para citas/notas)
const signRegisterToken = (u) =>
  jwt.sign(
    {
      sub: u.id,
      email: u.email,
      rol: u.rol,
      nombre: u.nombre,
      kind: 'register', // tipo de token: registro
    },
    SECRET,
    { expiresIn: '10m' } // por ejemplo 10 minutos
  );

// ======================================================
// Health real contra la DB
// ======================================================
app.get('/health', async () => {
  try {
    await pool.query('SELECT 1');
    return { ok: true, service: 'auth', db: 'postgres' };
  } catch (e) {
    return {
      ok: false,
      service: 'auth',
      db: 'down',
      error: e.code || e.message,
    };
  }
});

// ======================================================
// Register
// ======================================================
async function handleRegister(req, reply) {
  try {
    const {
      email,
      password,
      rol = 'paciente',
      nombre = 'Usuario',
    } = req.body || {};

    if (!email || !password) {
      return reply
        .code(400)
        .send({ message: 'email y password son obligatorios' });
    }

    const user = await createUser({ email, password, rol, nombre });

    // 👉 Token de registro (NO se usará en citas/notas)
    const registerToken = signRegisterToken(user);

    return reply.code(201).send({
      user,
      registerToken,
      message: 'Registro exitoso. Ahora inicia sesión para continuar.',
    });
  } catch (err) {
    if (err.code === 'E_DUP_EMAIL') {
      return reply.code(409).send({ message: 'Email ya registrado' });
    }
    if (err.code === 'E_BAD_ROLE') {
      return reply.code(400).send({
        message: 'Rol inválido (use: paciente|medico|admin)',
      });
    }
    req.log.error({ err }, 'register failed');
    return reply.code(500).send({ message: 'Error registrando usuario' });
  }
}

app.post('/auth/register', handleRegister);
app.post('/register', handleRegister); // alias

// ======================================================
// Login
// ======================================================
async function handleLogin(req, reply) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return reply
        .code(400)
        .send({ message: 'email y password son obligatorios' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return reply.code(401).send({ message: 'Credenciales inválidas' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return reply.code(401).send({ message: 'Credenciales inválidas' });
    }

    const { password_hash, ...pub } = user;

    // 👉 Token de sesión (este es el que usa el portal)
    const accessToken = signAccessToken(pub);

    return { accessToken, user: pub };
  } catch (err) {
    req.log.error({ err }, 'login failed');
    return reply.code(500).send({ message: 'Error en login' });
  }
}

app.post('/auth/login', handleLogin);
app.post('/login', handleLogin); // alias

// ======================================================
// Arranque
// ======================================================
app
  .listen({ port: PORT, host: HOST })
  .then(async () => {
    app.log.info(`Auth up on http://${HOST}:${PORT}`);
    try {
      await init(); // crea tablas / verifica DB
      app.log.info('DB init done ✅');
    } catch (e) {
      app.log.error({ err: e }, 'DB init failed (app sigue arriba)');
    }
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });








