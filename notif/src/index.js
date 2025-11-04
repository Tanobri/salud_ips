const Fastify = require("fastify");
const app = Fastify({ logger: true });

// healthcheck
app.get("/health", async () => ({ ok: true, service: "notif" }));

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";
app.listen({ port, host }).catch((err) => { app.log.error(err); process.exit(1); });
