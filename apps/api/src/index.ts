import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ?? path.join(here, "..", "data");

const app = await buildApp({
  dbPath: process.env.DB_PATH ?? path.join(dataDir, "easystream.sqlite"),
  jwtSecret: process.env.JWT_SECRET ?? "dev-easystream-secret-change-me",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
  uploadDir: process.env.UPLOAD_DIR ?? path.join(dataDir, "uploads"),
  logger: true,
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
