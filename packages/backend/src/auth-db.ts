// Channel APIs share one administrator identity/session store. Editorial data stays isolated.
import postgres from "postgres";
import { sql } from "./db.ts";
const url = process.env.AUTH_DATABASE_URL;
export const authSql = url && url !== process.env.DATABASE_URL ? postgres(url, { max: 2, idle_timeout: 10 }) : sql;
export async function closeAuthDb() { if (authSql !== sql) await authSql.end({ timeout: 5 }); }
