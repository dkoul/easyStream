import { buildApp } from "./app.js";
import { MemoryStore } from "./memory-store.js";
import { createSupabaseAdmin, DEFAULT_SUPABASE_URL, SupabaseStore } from "./supabase-store.js";

const supabaseUrl = process.env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const store = supabaseKey
  ? new SupabaseStore(createSupabaseAdmin(supabaseUrl, supabaseKey))
  : new MemoryStore();

if (!supabaseKey) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Event metadata is in memory only. Add the secret and restart.",
  );
} else {
  console.info(`Storing event metadata in Supabase (${supabaseUrl})`);
}

const app = await buildApp({
  jwtSecret: process.env.JWT_SECRET ?? "dev-easystream-secret-change-me",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
  store,
  logger: true,
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
