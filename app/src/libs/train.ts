import { StatTypes, GeneralType } from "@/drizzle/constants";
import { tagTypes } from "./combat/types";
import { getUserFederalStatus } from "@/utils/paypal";
import { LetterRanks } from "@/drizzle/constants";
import { FED_NORMAL_JUTSU_SLOTS } from "@/drizzle/constants";
import { FED_SILVER_JUTSU_SLOTS } from "@/drizzle/constants";
import { FED_GOLD_JUTSU_SLOTS } from "@/drizzle/constants";
import { VILLAGE_REDUCED_GAINS_DAYS } from "@/drizzle/constants";
import { VILLAGE_LEAVE_REQUIRED_RANK } from "@/drizzle/constants";
import { secondsPassed } from "@/utils/time";
import type { LetterRank } from "@/drizzle/constants";
import type { TrainingSpeed, BattleType } from "@/drizzle/constants";
import type { Jutsu, JutsuRank } from "@/drizzle/schema";
import type { UserData, UserRank } from "@/drizzle/schema";

export const availableLetterRanks = (userrank: UserRank): LetterRank[] => {
  switch (userrank) {
    case "STUDENT":
      return ["D"];
    case "GENIN":
      return ["D", "C"];
    case "CHUNIN":
      return ["D", "C", "B", "A"];
    case "JONIN":
      return ["D", "C", "B", "A", "S"];
    case "ELDER":
      return ["D", "C", "B", "A", "S"];
    case "COMMANDER":
      return ["D", "C", "B", "A", "S"];
  }
  return ["D"];
};

export const hasRequiredRank = (userRank?: UserRank, requiredRank?: UserRank) => {
  if (!userRank) return false;
  if (!requiredRank) return true;
  switch (requiredRank) {
    case "STUDENT":
      return true;
    case "GENIN":
      return ["GENIN", "CHUNIN", "JONIN", "ELDER", "COMMANDER"].includes(userRank);
    case "CHUNIN":
      return ["CHUNIN", "JONIN", "ELDER", "COMMANDER"].includes(userRank);
    case "JONIN":
      return ["JONIN", "ELDER", "COMMANDER"].includes(userRank);
    case "COMMANDER":
      return userRank === "COMMANDER";
  }
  return false;
};

export const getReducedGainsDays = (user: UserData) => {
  if (hasRequiredRank(user.rank, VILLAGE_LEAVE_REQUIRED_RANK)) {
    const daysPassed = secondsPassed(user.joinedVillageAt) / 86400;
    const daysLeft = VILLAGE_REDUCED_GAINS_DAYS - daysPassed;
    if (daysLeft > 0) {
      return daysLeft;
    }
  }
  return 0;
};

export const availableRanks = (letterRank?: LetterRank): UserRank[] => {
  switch (letterRank) {
    case "D":
      return ["STUDENT"];
    case "C":
      return ["STUDENT", "GENIN"];
    case "B":
      return ["STUDENT", "GENIN", "CHUNIN"];
    case "A":
      return ["STUDENT", "GENIN", "CHUNIN", "JONIN", "ELDER"];
    case "S":
      return ["STUDENT", "GENIN", "CHUNIN", "JONIN", "ELDER", "COMMANDER"];
  }
  return ["STUDENT", "GENIN", "CHUNIN", "JONIN", "ELDER", "COMMANDER"];
};

export const getAvailableLetterRanks = (rank: LetterRank) => {
  const ranks = LetterRanks.slice(0, LetterRanks.indexOf(rank) + 1);
  return ranks;
};

export const checkJutsuRank = (rank: JutsuRank | undefined, userrank: UserRank) => {
  if (!rank) return false;
  return availableLetterRanks(userrank).includes(rank);
};

export const checkJutsuVillage = (jutsu: Jutsu | undefined, userdata: UserData) => {
  if (!jutsu) return false;
  return !jutsu.villageId || jutsu.villageId === userdata.villageId;
};

export const checkJutsuBloodline = (jutsu: Jutsu | undefined, userdata: UserData) => {
  if (!jutsu) return false;
  return !jutsu.bloodlineId || jutsu.bloodlineId === userdata.bloodlineId;
};

export const canTrainJutsu = (jutsu: Jutsu, userdata: UserData) => {
  return (
    hasRequiredRank(userdata.rank, jutsu.requiredRank) &&
    checkJutsuRank(jutsu.jutsuRank, userdata.rank) &&
    checkJutsuVillage(jutsu, userdata) &&
    checkJutsuBloodline(jutsu, userdata)
  );
};

export const JUTSU_LEVEL_CAP = 20;
export const JUTSU_TRAIN_LEVEL_CAP = 30;

export const SENSEI_JUTSU_TRAINING_BOOST_PERC = 5;

export const calcJutsuTrainTime = (jutsu: Jutsu, level: number, userdata: UserData) => {
  let lvlIncrement = 7;
  if (jutsu.jutsuRank === "C") {
    lvlIncrement = 8;
  } else if (jutsu.jutsuRank === "B") {
    lvlIncrement = 9;
  } else if (jutsu.jutsuRank === "A") {
    lvlIncrement = 10;
  } else if (jutsu.jutsuRank === "S") {
    lvlIncrement = 11;
  }
  const trainTime = (1 + level * lvlIncrement) * 60 * 1000;
  if (userdata.senseiId && userdata.rank === "GENIN") {
    return trainTime * (1 - SENSEI_JUTSU_TRAINING_BOOST_PERC / 100);
  }
  return trainTime;
};

export const calcJutsuTrainCost = (jutsu: Jutsu, level: number) => {
  let base = 50;
  if (jutsu.jutsuRank === "C") {
    base = 100;
  } else if (jutsu.jutsuRank === "B") {
    base = 150;
  } else if (jutsu.jutsuRank === "A") {
    base = 200;
  } else if (jutsu.jutsuRank === "S") {
    base = 250;
  }
  return Math.floor(Math.pow(base, 1 + level / 20));
};

export const calcForgetReturn = (jutsu: Jutsu, level: number) => {
  const discount = 0.9;
  let result = 0;
  for (let i = 0; i < level; i++) {
    result += calcJutsuTrainCost(jutsu, i);
  }
  return result * discount;
};

export const calcJutsuEquipLimit = (userdata: UserData) => {
  const rankContrib = (rank: UserRank) => {
    // TODO: Decrease this once we have more ranking going on
    switch (rank) {
      case "GENIN":
        return 5 + 2;
      case "CHUNIN":
        return 6 + 2;
      case "JONIN":
        return 7 + 2;
      case "ELDER":
        return 7 + 2;
      case "COMMANDER":
        return 8 + 2;
    }
    return 4 + 2;
  };
  const fedContrib = (userdata: UserData) => {
    const status = getUserFederalStatus(userdata);
    switch (status) {
      case "NORMAL":
        return FED_NORMAL_JUTSU_SLOTS;
      case "SILVER":
        return FED_SILVER_JUTSU_SLOTS;
      case "GOLD":
        return FED_GOLD_JUTSU_SLOTS;
    }
    return 0;
  };
  return 1 + rankContrib(userdata.rank) + fedContrib(userdata);
};

// For categorizing jutsu
export const mainFilters = [
  "No Filter",
  "Name",
  "Most Recent",
  "Bloodline",
  "Stat",
  "Effect",
  "Element",
  "AppearAnimation",
  "StaticAnimation",
  "DisappearAnimation",
] as const;
export const statFilters = [...StatTypes, ...GeneralType] as const;
export const effectFilters = tagTypes;
export const rarities = ["ALL", ...LetterRanks] as const;
export type FilterType = (typeof mainFilters)[number];
export type StatGenType = (typeof statFilters)[number];
export type EffectType = (typeof effectFilters)[number];
export type RarityType = (typeof rarities)[number];

/**
 * Get training efficiency
 */
export const trainEfficiency = (user: UserData) => {
  switch (user.trainingSpeed) {
    case "15min":
      return 100;
    case "1hr":
      return 90;
    case "4hrs":
      return 80;
    case "8hrs":
      return 70;
    default:
      throw Error("Invalid training speed");
  }
};

/**
 * Get training multiplier
 */
export const trainingMultiplier = (user: UserData) => {
  const reducedDays = getReducedGainsDays(user);
  const factor = reducedDays > 0 ? 0.5 : 1;
  switch (user.trainingSpeed) {
    case "15min":
      return 0.01 * factor;
    case "1hr":
      return 0.04 * factor;
    case "4hrs":
      return 0.16 * factor;
    case "8hrs":
      return 0.32 * factor;
    default:
      throw Error("Invalid training speed");
  }
};

/**
 * Get training energy per second
 */
export const energyPerSecond = (speed: TrainingSpeed) => {
  switch (speed) {
    case "15min":
      return 100 / (15 * 60);
    case "1hr":
      return 100 / (60 * 60);
    case "4hrs":
      return 100 / (4 * 60 * 60);
    case "8hrs":
      return 100 / (8 * 60 * 60);
    default:
      throw Error("Invalid training speed");
  }
};

// Jutsu experience gain based on battle type
export const battleJutsuExp = (battleType: BattleType, experienceGain: number) => {
  switch (battleType) {
    case "COMBAT":
      return experienceGain;
    case "ARENA":
      return experienceGain * 0.5;
    case "QUEST":
      return experienceGain * 0.5;
  }
  return 0;
};
