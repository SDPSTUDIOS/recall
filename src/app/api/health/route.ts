import { connection } from "next/server";
import { db } from "@/lib/db";
import { APP_VERSION } from "@/lib/version";

/**
 * Used by the launcher to tell when the server is up, and that it's Recall rather
 * than something else on the port. Touches SQLite so a broken native build fails here.
 */
export async function GET() {
  await connection();
  db.prepare("SELECT 1").get();
  return Response.json({ app: "recall", version: APP_VERSION });
}
