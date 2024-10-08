import { VisualTag } from "./types";
import { findUser, findBarrier } from "./util";
import { collapseConsequences, sortEffects } from "./util";
import { shouldApplyEffectTimes } from "./util";
import { calcEffectRoundInfo, isEffectActive } from "./util";
import { nanoid } from "nanoid";
import { clone, move, heal, damageBarrier, damageUser } from "./tags";
import { absorb, reflect, recoil, lifesteal } from "./tags";
import { increaseStats, decreaseStats } from "./tags";
import { increaseDamageGiven, decreaseDamageGiven } from "./tags";
import { increaseDamageTaken, decreaseDamageTaken } from "./tags";
import { increaseHealGiven, decreaseHealGiven } from "./tags";
import { increasepoolcost, decreasepoolcost } from "./tags";
import { flee, fleePrevent } from "./tags";
import { stun, stunPrevent, onehitkill, onehitkillPrevent } from "./tags";
import { seal, sealPrevent, sealCheck, rob, robPrevent } from "./tags";
import { clear, cleanse, summon, summonPrevent } from "./tags";
import { updateStatUsage } from "./tags";
import { BATTLE_TAG_STACKING } from "@/drizzle/constants";
import type { BattleUserState, ReturnedUserState } from "./types";
import type { GroundEffect, UserEffect, ActionEffect, BattleEffect } from "./types";
import type { AnimationName } from "./types";
import type { CompleteBattle, Consequence } from "./types";

/**
 * Check whether to apply given effect to a user, based on friendly fire settings
 */
export const checkFriendlyFire = (
  effect: BattleEffect,
  target: ReturnedUserState,
  usersState: BattleUserState[],
) => {
  // In case of multiple villages in the battle; friendly based on villageId, otherwise based on controllerId
  const villageIds = [...new Set(usersState.map((u) => u.villageId))];
  const isFriendly =
    villageIds.length > 1
      ? target.villageId === effect.villageId
      : target.controllerId === effect.creatorId;
  // Check if effect is friendly fire
  if (
    !effect.friendlyFire ||
    effect.friendlyFire === "ALL" ||
    (effect.friendlyFire === "FRIENDLY" && isFriendly) ||
    (effect.friendlyFire === "ENEMIES" && !isFriendly)
  ) {
    return true;
  }
  return false;
};

/**
 * Realize tag with information about how powerful tag is
 */
export const realizeTag = <T extends BattleEffect>(props: {
  tag: T;
  user: BattleUserState;
  target?: BattleUserState | undefined;
  level: number | undefined;
  round?: number;
  barrierAbsorb?: number;
}): T => {
  const { tag, user, target, level, round, barrierAbsorb } = props;
  if ("rounds" in tag) {
    tag.timeTracker = {};
  }
  if ("power" in tag) {
    tag.power = tag.power;
  }
  tag.id = nanoid();
  tag.createdRound = round || 0;
  tag.creatorId = user.userId;
  tag.villageId = user.villageId;
  tag.targetType = "user";
  tag.level = level ?? 0;
  tag.isNew = true;
  tag.castThisRound = true;
  tag.highestOffence = user.highestOffence;
  tag.highestDefence = user.highestDefence;
  tag.highestGenerals = user.highestGenerals;
  tag.barrierAbsorb = barrierAbsorb || 0;
  if (target) {
    tag.targetHighestOffence = target.highestOffence;
    tag.targetHighestDefence = target.highestDefence;
    tag.targetHighestGenerals = target.highestGenerals;
  }
  return structuredClone(tag);
};

/**
 * Create a visual effect with a specified appearAnimation
 */
const getVisual = (
  longitude: number,
  latitude: number,
  animation?: AnimationName,
  round: number = 0,
): GroundEffect => {
  return {
    ...VisualTag.parse({
      type: "visual",
      rounds: 0,
      description: "N/A",
      appearAnimation: animation,
      createdAt: Date.now(),
    }),
    id: nanoid(),
    createdRound: round,
    creatorId: nanoid(),
    level: 0,
    barrierAbsorb: 0,
    isNew: true,
    castThisRound: true,
    longitude,
    latitude,
  };
};

export const applyEffects = (battle: CompleteBattle, actorId: string) => {
  // Destructure
  const { usersState, usersEffects, groundEffects, round } = battle;
  // Things we wish to return
  const newUsersState = structuredClone(usersState);
  const newGroundEffects: GroundEffect[] = [];
  const newUsersEffects: UserEffect[] = [];
  const actionEffects: ActionEffect[] = [];

  // Convert all ground effects to user effects on the users standing on the tile
  // console.log(
  //   "Ground effects: ",
  //   groundEffects.length,
  //   groundEffects.map((e) => e.type)
  // );
  groundEffects.sort(sortEffects).forEach((e) => {
    // Get the round information for the effect
    const { startRound, curRound } = calcEffectRoundInfo(e, battle);
    e.castThisRound = startRound === curRound;
    // Process special effects
    let info: ActionEffect | undefined = undefined;
    if (e.type === "move") {
      move(e, newUsersState, newGroundEffects);
    } else {
      // Special handling of clone & summon ground-effects
      if (e.type === "clone") {
        info = clone(newUsersState, e);
      } else if (e.type === "summon") {
        info = summon(newUsersState, e);
      } else if (e.type === "barrier") {
        const user = findUser(newUsersState, e.longitude, e.latitude);
        if (user) e.rounds = 0;
      } else {
        // Apply all other ground effects to user
        const user = findUser(newUsersState, e.longitude, e.latitude);
        if (user && e.type !== "visual") {
          if (checkFriendlyFire(e, user, newUsersState)) {
            usersEffects.push({
              ...e,
              targetId: user.userId,
              fromGround: true,
            } as UserEffect);
          }
        }
        // Forward any damage effects, which should be applied to barriers as well
        if (!user && e.type === "damage") {
          const barrier = findBarrier(groundEffects, e.longitude, e.latitude);
          if (barrier) {
            usersEffects.push({
              ...e,
              targetType: "barrier",
              targetId: barrier.id,
              fromGround: true,
            } as UserEffect);
          }
        }
      }
      // Let ground effect continue, or is it done?
      if (isEffectActive(e) || e.type === "visual") {
        e.isNew = false;
        newGroundEffects.push(e);
      } else if (e.disappearAnimation) {
        newGroundEffects.push(
          getVisual(e.longitude, e.latitude, e.disappearAnimation, round),
        );
      }
    }
    if (e.appearAnimation && e.isNew && e.type !== "visual") {
      newGroundEffects.push(
        getVisual(e.longitude, e.latitude, e.appearAnimation, round),
      );
    }
    if (info) actionEffects.push(info);
  });

  // Book-keeping for damage and heal effects
  const consequences = new Map<string, Consequence>();

  // Fetch any active sealing effects
  const sealEffects = usersEffects.filter(
    (e) => e.type === "seal" && !e.isNew && isEffectActive(e),
  );

  // Remember effects applied to different users, so that we only apply effects once
  const appliedEffects = new Set<string>();

  // Apply all user effects to their target users
  usersEffects.sort(sortEffects).forEach((e) => {
    // Get the round information for the effect
    const { startRound, curRound } = calcEffectRoundInfo(e, battle);
    e.castThisRound = startRound === curRound;
    // Bookkeeping
    let longitude: number | undefined = undefined;
    let latitude: number | undefined = undefined;
    let info: ActionEffect | undefined = undefined;
    // Get user now and next
    const curUser = usersState.find((u) => u.userId === e.creatorId);
    const newUser = newUsersState.find((u) => u.userId === e.creatorId);
    // Remember the effect
    const idx = `${e.type}-${e.creatorId}-${e.targetId}-${e.fromType}`;
    // Determine whether the tags should stack
    const cacheCheck = BATTLE_TAG_STACKING
      ? true
      : !appliedEffects.has(idx) || e.fromType === "bloodline";
    // Special cases
    if (e.type === "damage" && e.targetType === "barrier" && curUser) {
      const result = damageBarrier(newGroundEffects, curUser, e);
      if (result) {
        longitude = result.barrier.longitude;
        latitude = result.barrier.latitude;
        actionEffects.push(result.info);
      }
    } else if (e.targetType === "user" && cacheCheck) {
      // Get the user && effect details
      const curTarget = usersState.find((u) => u.userId === e.targetId);
      const newTarget = newUsersState.find((u) => u.userId === e.targetId);
      const applyTimes = shouldApplyEffectTimes(e, battle, e.targetId);
      const isSealed = sealCheck(e, sealEffects);
      const isTargetOrNew = e.targetId === actorId || e.isNew;
      if (curUser && newUser && curTarget && newTarget && applyTimes > 0 && !isSealed) {
        appliedEffects.add(idx);
        longitude = curTarget?.longitude;
        latitude = curTarget?.latitude;
        // Tags only applied when target is user or new
        if (isTargetOrNew) {
          if (e.type === "damage" && isTargetOrNew) {
            info = damageUser(e, curUser, curTarget, consequences, applyTimes);
          } else if (e.type === "heal" && isTargetOrNew) {
            info = heal(e, curTarget, consequences, applyTimes);
          } else if (e.type === "flee" && isTargetOrNew) {
            info = flee(e, newUsersEffects, newTarget);
          } else if (e.type === "increasepoolcost" && isTargetOrNew) {
            info = increasepoolcost(e, curTarget);
          } else if (e.type === "decreasepoolcost" && isTargetOrNew) {
            info = decreasepoolcost(e, curTarget);
          } else if (e.type === "clear" && isTargetOrNew) {
            info = clear(e, usersEffects, curTarget);
          } else if (e.type === "cleanse" && isTargetOrNew) {
            info = cleanse(e, usersEffects, curTarget);
          } else if (e.type === "increasedamagegiven") {
            info = increaseDamageGiven(e, usersEffects, consequences, curTarget);
          } else if (e.type === "decreasedamagegiven") {
            info = decreaseDamageGiven(e, usersEffects, consequences, curTarget);
          } else if (e.type === "onehitkill") {
            info = onehitkill(e, newUsersEffects, newTarget);
          } else if (e.type === "rob") {
            info = rob(e, newUsersEffects, newUser, newTarget);
          } else if (e.type === "seal") {
            info = seal(e, newUsersEffects, curTarget);
          } else if (e.type === "stun") {
            info = stun(e, newUsersEffects, curTarget);
          }
        }

        // Tags to apply always
        if (e.type === "absorb") {
          info = absorb(e, usersEffects, consequences, curTarget);
        } else if (e.type === "increasestat") {
          info = increaseStats(e, curTarget);
        } else if (e.type === "decreasestat") {
          info = decreaseStats(e, curTarget);
        } else if (e.type === "increasedamagetaken") {
          info = increaseDamageTaken(e, usersEffects, consequences, curTarget);
        } else if (e.type === "decreasedamagetaken") {
          info = decreaseDamageTaken(e, usersEffects, consequences, curTarget);
        } else if (e.type === "increaseheal") {
          info = increaseHealGiven(e, usersEffects, consequences, curTarget);
        } else if (e.type === "decreaseheal") {
          info = decreaseHealGiven(e, usersEffects, consequences, curTarget);
        } else if (e.type === "reflect") {
          info = reflect(e, usersEffects, consequences, curTarget);
        } else if (e.type === "recoil") {
          info = recoil(e, usersEffects, consequences, curTarget);
        } else if (e.type === "lifesteal") {
          info = lifesteal(e, usersEffects, consequences, curTarget);
        } else if (e.type === "fleeprevent") {
          info = fleePrevent(e, curTarget);
        } else if (e.type === "onehitkillprevent") {
          info = onehitkillPrevent(e, curTarget);
        } else if (e.type === "robprevent") {
          info = robPrevent(e, curTarget);
        } else if (e.type === "sealprevent") {
          info = sealPrevent(e, curTarget);
        } else if (e.type === "stunprevent") {
          info = stunPrevent(e, curTarget);
        } else if (e.type === "summonprevent") {
          info = summonPrevent(e, curTarget);
        }
        updateStatUsage(newTarget, e, true);
      }
    }

    // Show text results of actions
    if (info) {
      actionEffects.push(info);
    }

    // Show once appearing animation
    if (e.appearAnimation && longitude && latitude) {
      newGroundEffects.push(
        getVisual(longitude, latitude, e.appearAnimation, battle.round),
      );
    }

    // Process round reduction & tag removal
    if ((isEffectActive(e) && !e.fromGround) || e.type === "visual") {
      e.isNew = false;
      newUsersEffects.push(e);
    } else if (e.disappearAnimation && longitude && latitude) {
      newGroundEffects.push(
        getVisual(longitude, latitude, e.disappearAnimation, round),
      );
    }
  });

  // Apply consequences to users
  Array.from(consequences.values())
    .reduce(collapseConsequences, [] as Consequence[])
    .forEach((c) => {
      const user = newUsersState.find((u) => u.userId === c.userId);
      const target = newUsersState.find((u) => u.userId === c.targetId);
      if (target && user) {
        if (c.damage && c.damage > 0) {
          target.curHealth -= c.damage;
          target.curHealth = Math.max(0, target.curHealth);
          actionEffects.push({
            txt: `${target.username} takes ${c.damage.toFixed(2)} damage`,
            color: "red",
            types: c.types,
          });
        }
        if (c.heal_hp && c.heal_hp > 0) {
          target.curHealth += c.heal_hp;
          target.curHealth = Math.min(target.maxHealth, target.curHealth);
          actionEffects.push({
            txt: `${target.username} heals ${c.heal_hp} HP`,
            color: "green",
          });
        }
        if (c.heal_sp && c.heal_sp > 0) {
          target.curStamina += c.heal_sp;
          target.curStamina = Math.min(target.maxStamina, target.curStamina);
          actionEffects.push({
            txt: `${target.username} heals ${c.heal_sp} SP`,
            color: "green",
          });
        }
        if (c.heal_cp && c.heal_cp > 0) {
          target.curChakra += c.heal_cp;
          target.curChakra = Math.min(target.maxChakra, target.curChakra);
          actionEffects.push({
            txt: `${target.username} heals ${c.heal_cp} CP`,
            color: "green",
          });
        }
        if (c.reflect && c.reflect > 0) {
          user.curHealth -= c.reflect;
          user.curHealth = Math.max(0, user.curHealth);
          actionEffects.push({
            txt: `${user.username} takes ${c.reflect.toFixed(2)} reflect damage`,
            color: "red",
          });
        }
        if (c.recoil && c.recoil > 0) {
          user.curHealth -= c.recoil;
          user.curHealth = Math.max(0, user.curHealth);
          actionEffects.push({
            txt: `${user.username} takes ${c.recoil.toFixed(2)} recoil damage`,
            color: "red",
          });
        }
        if (c.lifesteal_hp && c.lifesteal_hp > 0) {
          user.curHealth += c.lifesteal_hp;
          user.curHealth = Math.max(0, user.curHealth);
          actionEffects.push({
            txt: `${user.username} steals ${c.lifesteal_hp.toFixed(2)} damage as health`,
            color: "green",
          });
        }
        if (c.absorb_hp && c.absorb_hp > 0 && target.curHealth > 0) {
          target.curHealth += c.absorb_hp;
          target.curHealth = Math.min(target.maxHealth, target.curHealth);
          actionEffects.push({
            txt: `${target.username} absorbs ${c.absorb_hp.toFixed(
              2,
            )} damage and converts it to health`,
            color: "green",
          });
        }
        if (c.absorb_sp && c.absorb_sp > 0) {
          target.curStamina += c.absorb_sp;
          target.curStamina = Math.min(target.maxHealth, target.curStamina);
          actionEffects.push({
            txt: `${target.username} absorbs ${c.absorb_sp.toFixed(
              2,
            )} damage and converts it to stamina`,
            color: "green",
          });
        }
        if (c.absorb_cp && c.absorb_cp > 0) {
          target.curChakra += c.absorb_cp;
          target.curChakra = Math.min(target.maxHealth, target.curChakra);
          actionEffects.push({
            txt: `${target.username} absorbs ${c.absorb_cp.toFixed(
              2,
            )} damage and converts it to chakra`,
            color: "green",
          });
        }
        // Process disappear animation of characters
        if (target.curHealth <= 0 && !target.isOriginal) {
          newGroundEffects.push(
            getVisual(target.longitude, target.latitude, "smoke", round),
          );
        }
        if (user.curHealth <= 0 && !user.isOriginal) {
          newGroundEffects.push(
            getVisual(user.longitude, user.latitude, "smoke", round),
          );
        }
      }
    });

  return {
    newBattle: {
      ...battle,
      usersState: newUsersState,
      usersEffects: newUsersEffects,
      groundEffects: newGroundEffects,
    },
    actionEffects,
  };
};
