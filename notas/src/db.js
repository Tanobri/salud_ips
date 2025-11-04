// src/db.js (Cosmos DB con createIfNotExists + fallback si no hay credenciales)
const { CosmosClient } = require("@azure/cosmos");

let container = null;

async function init() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const dbName = process.env.COSMOS_DB || "salud";
  const containerName = process.env.COSMOS_CONTAINER || "notas";

  if (!endpoint || !key) {
    console.warn("[notas] COSMOS_ENDPOINT/COSMOS_KEY no definidos -> modo MEMORIA");
    return false;
  }

  const client = new CosmosClient({ endpoint, key });
  const { database } = await client.databases.createIfNotExists({ id: dbName });
  const { container: c } = await database.containers.createIfNotExists({
    id: containerName,
    partitionKey: "/citaId",           // clave de partición
    throughput: 400,                   // autoscale simple (MVP)
  });
  container = c;
  console.log("[notas] Cosmos DB listo ✅");
  return true;
}

function hasDb() { return !!container; }

// Crea/actualiza una nota (UPERT)
async function createNota({ id, citaId, autorId, S, O, A, P, createdAt }) {
  if (!container) throw new Error("NO_DB");
  const { resource } = await container.items.upsert({
    id, citaId, autorId, S, O, A, P, createdAt
  });
  return resource;
}

// Lista notas por citaId
async function listByCita(citaId) {
  if (!container) throw new Error("NO_DB");
  const query = {
    query: "SELECT * FROM c WHERE c.citaId = @citaId ORDER BY c.createdAt DESC",
    parameters: [{ name: "@citaId", value: citaId }],
  };
  const { resources } = await container.items.query(query).fetchAll();
  return resources;
}

module.exports = { init, hasDb, createNota, listByCita };
