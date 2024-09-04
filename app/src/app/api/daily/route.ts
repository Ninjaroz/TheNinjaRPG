import { TRPCError } from "@trpc/server";
import { eq, ne, inArray, isNull, isNotNull, and, or, sql, lt } from "drizzle-orm";
import { drizzleDB } from "@/server/db";
import { quest, questHistory, userData, userRequest } from "@/drizzle/schema";
import { anbuSquad, clan } from "@/drizzle/schema";
import { UserRanks } from "@/drizzle/constants";
import { availableQuestLetterRanks } from "@/libs/train";
import { secondsFromNow } from "@/utils/time";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { updateGameSetting, checkGameTimer } from "@/libs/gamesettings";
import { upsertQuestEntries } from "@/routers/quests";
import { structureBoost } from "@/utils/village";
import { calcBankInterest } from "@/utils/village";
import { RYO_CAP } from "@/drizzle/constants";
import { FED_NORMAL_BANK_INTEREST } from "@/drizzle/constants";
import { FED_SILVER_BANK_INTEREST } from "@/drizzle/constants";
import { FED_GOLD_BANK_INTEREST } from "@/drizzle/constants";
import { cookies } from "next/headers";

/**
 * DANGER ZONE
 * This function is responsible for the daily update of the game state.
 * It is a critical function that should be handled with care!!!
 * @returns
 */
export async function GET() {
  // disable cache for this server action (https://github.com/vercel/next.js/discussions/50045)
  cookies();

  // Check timer
  const frequency = 24;
  const response = await checkGameTimer(drizzleDB, frequency);
  if (response) return response;

  // Update timer
  await updateGameSetting(drizzleDB, `timer-${frequency}h`, 0, new Date());

  // Query
  const villages = await drizzleDB.query.village.findMany({
    with: { structures: true },
  });

  try {
    // STEP 1: Bank interest for each village
    await Promise.all(
      villages.map((village) => {
        const boost = structureBoost("bankInterestPerLvl", village.structures);
        const factor = 1 + calcBankInterest(boost) / 100;
        const factorNormal = factor + FED_NORMAL_BANK_INTEREST / 100;
        const factorSilver = factor + FED_SILVER_BANK_INTEREST / 100;
        const factorGold = factor + FED_GOLD_BANK_INTEREST / 100;
        return Promise.all([
          drizzleDB
            .update(userData)
            .set({
              bank: sql`${userData.bank} + LEAST(${userData.bank} * ${factor} - ${userData.bank}, 1000000)`,
            })
            .where(
              and(
                eq(userData.villageId, village.id),
                eq(userData.federalStatus, "NONE"),
                eq(userData.role, "USER"),
                lt(userData.bank, RYO_CAP),
              ),
            ),
          drizzleDB
            .update(userData)
            .set({
              bank: sql`${userData.bank} + LEAST(${userData.bank} * ${factorNormal} - ${userData.bank}, 1000000)`,
            })
            .where(
              and(
                eq(userData.villageId, village.id),
                eq(userData.federalStatus, "NORMAL"),
                eq(userData.role, "USER"),
                lt(userData.bank, RYO_CAP),
              ),
            ),
          drizzleDB
            .update(userData)
            .set({
              bank: sql`${userData.bank} + LEAST(${userData.bank} * ${factorSilver} - ${userData.bank}, 1000000)`,
            })
            .where(
              and(
                eq(userData.villageId, village.id),
                eq(userData.federalStatus, "SILVER"),
                eq(userData.role, "USER"),
                lt(userData.bank, RYO_CAP),
              ),
            ),
          drizzleDB
            .update(userData)
            .set({
              bank: sql`${userData.bank} + LEAST(${userData.bank} * ${factorGold} - ${userData.bank}, 1000000)`,
            })
            .where(
              and(
                eq(userData.villageId, village.id),
                or(eq(userData.federalStatus, "GOLD"), ne(userData.role, "USER")),
                lt(userData.bank, RYO_CAP),
              ),
            ),
        ]);
      }),
    );

    // STEP 2: Clear old challenges
    await drizzleDB
      .delete(userRequest)
      .where(lt(userRequest.createdAt, secondsFromNow(-3600 * 24)));

    // STEP 3: Update village prestige & daily limits
    await drizzleDB.update(userData).set({
      villagePrestige: sql`${userData.villagePrestige} + 1`,
      dailyArenaFights: 0,
      dailyMissions: 0,
      dailyErrands: 0,
      dailyTrainings: 0,
    });

    // STEP 4: Update daily quests
    await drizzleDB
      .update(questHistory)
      .set({ completed: 0, endAt: new Date() })
      .where(and(eq(questHistory.questType, "daily"), eq(questHistory.completed, 0)));
    await Promise.all(
      UserRanks.map((rank) => {
        const ranks = availableQuestLetterRanks(rank);
        if (ranks.length > 0) {
          void villages.map(async (village) => {
            const newDaily = await drizzleDB.query.quest.findFirst({
              where: and(
                eq(quest.questType, "daily"),
                isNotNull(quest.content),
                inArray(quest.questRank, ranks),
                or(
                  isNull(quest.requiredVillage),
                  eq(quest.requiredVillage, village.id ?? ""),
                ),
              ),
              orderBy: sql`RAND()`,
            });
            if (newDaily) {
              await upsertQuestEntries(
                drizzleDB,
                newDaily,
                and(eq(userData.rank, rank), eq(userData.villageId, village.id)),
              );
            }
          });
        }
      }),
    );

    // STEP 5: decaying PvP activity counters
    await Promise.all([
      drizzleDB.update(userData).set({
        pvpActivity: sql`${userData.pvpActivity} * 0.95`,
      }),
      drizzleDB.update(anbuSquad).set({
        pvpActivity: sql`${anbuSquad.pvpActivity} * 0.95`,
      }),
      drizzleDB.update(clan).set({
        pvpActivity: sql`${clan.pvpActivity} * 0.95`,
        trainingBoost: sql`CASE WHEN ${clan.trainingBoost} > 0 THEN ${clan.trainingBoost} - 1 ELSE ${clan.trainingBoost} END`,
        ryoBoost: sql`CASE WHEN ${clan.ryoBoost} > 0 THEN ${clan.ryoBoost} - 1 ELSE ${clan.ryoBoost} END`,
      }),
    ]);

    return Response.json(`OK`);
  } catch (cause) {
    console.error(cause);
    if (cause instanceof TRPCError) {
      // An error from tRPC occured
      const httpCode = getHTTPStatusCodeFromError(cause);
      return Response.json(cause, { status: httpCode });
    }
    // Another error occured
    return Response.json("Internal server error", { status: 500 });
  }
}
