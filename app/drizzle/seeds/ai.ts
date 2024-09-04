import { userData, userJutsu } from "../schema";
import { sql, eq } from "drizzle-orm";
import { promises as fs } from "fs";
import type { DrizzleClient } from "@/server/db";

// Delete anything not in above list, and insert those missing
export const seedAI = async (client: DrizzleClient) => {
  console.log("\nClearing AIs...");
  await client.delete(userData).where(eq(userData.isAi, true));
  await client.execute(
    sql`DELETE FROM ${userJutsu} a WHERE NOT EXISTS (SELECT id FROM ${userData} b WHERE b.userId = a.userId)`,
  );
  // Insert AI
  console.log("Syncing AIs...");
  const aiData = await fs.readFile(process.cwd() + "/data/ai.sql", "utf8");
  await client.execute(sql.raw(`${aiData}`));
  // Insert AI jutsu
  console.log("Syncing AI jutsus...");
  const jutsuData = await fs.readFile(process.cwd() + "/data/userjutsu.sql", "utf8");
  await client.execute(sql.raw(`${jutsuData}`));
};
