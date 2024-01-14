import { TRPCError } from "@trpc/server";
import { eq, inArray, isNull, isNotNull, and, or, sql } from "drizzle-orm";
import { drizzleDB } from "@/server/db";
import { quest, questHistory, userData } from "@/drizzle/schema";
import { UserRanks } from "@/drizzle/constants";
import { availableRanks } from "@/libs/train";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { getTimer, updateTimer } from "@/libs/game_timers";
import type { NextApiRequest, NextApiResponse } from "next";
import { nanoid } from "nanoid";

const dailyUpdates = async (req: NextApiRequest, res: NextApiResponse) => {
  // Check timer
  const timer = await getTimer("daily");
  if (timer.time > new Date(Date.now() - 1000 * 60 * 60 * 23.5)) {
    return res.status(200).json("Ran within the last 23.5 hours");
  }

  const villages = await drizzleDB.query.village.findMany({});

  try {
    // STEP 1: Bank interest
    await drizzleDB.update(userData).set({ bank: sql`${userData.bank} * 1.01` });

    // STEP 2: Update daily quests
    await drizzleDB
      .update(questHistory)
      .set({ completed: 0, endAt: new Date() })
      .where(and(eq(questHistory.questType, "daily"), eq(questHistory.completed, 0)));
    await Promise.all(
      UserRanks.map((rank) => {
        const ranks = availableRanks(rank);
        if (ranks.length > 0) {
          villages.map(async (village) => {
            const newDaily = await drizzleDB.query.quest.findFirst({
              where: and(
                eq(quest.questType, "daily"),
                isNotNull(quest.content),
                inArray(quest.requiredRank, ranks),
                or(
                  isNull(quest.requiredVillage),
                  eq(quest.requiredVillage, village.id ?? "")
                )
              ),
              orderBy: sql`RAND()`,
            });
            const users = await drizzleDB.query.userData.findMany({
              columns: { userId: true },
              where: and(eq(userData.rank, rank), eq(userData.villageId, village.id)),
            });
            if (newDaily && users.length > 0) {
              await drizzleDB.insert(questHistory).values(
                users.map((user) => ({
                  id: nanoid(),
                  userId: user.userId,
                  questId: newDaily.id,
                  questType: "daily" as const,
                }))
              );
            }
          });
        }
      })
    );

    // Update timer
    await updateTimer("daily", new Date());

    res.status(200).json("OK");
  } catch (cause) {
    if (cause instanceof TRPCError) {
      // An error from tRPC occured
      const httpCode = getHTTPStatusCodeFromError(cause);
      return res.status(httpCode).json(cause);
    }
    // Another error occured
    console.error(cause);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default dailyUpdates;
