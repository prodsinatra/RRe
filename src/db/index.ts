import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = connectionString ? postgres(connectionString, { prepare: false }) : null;
export const db = client ? drizzle(client, { schema }) : null;
