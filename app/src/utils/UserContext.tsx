"use client";

import React, { createContext, useEffect, useState } from "react";
import Pusher from "pusher-js";
import { parseHtml } from "@/utils/parse";
import { useContext } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/app/_trpc/client";
import { secondsFromDate } from "@/utils/time";
import Link from "next/link";
import { showMutationToast } from "@/libs/toast";
import { ToastAction } from "@/components/ui/toast";
import { calcIsInVillage } from "@/libs/travel/controls";
import { canAccessStructure } from "@/utils/village";
import { atom } from "jotai";
import type { NavBarDropdownLink } from "@/libs/menus";
import type { UserWithRelations } from "@/api/routers/profile";
import type { ReturnedBattle } from "@/libs/combat/types";
import type { StructureRoute } from "@/drizzle/seeds/village";

/**
 * Atom for storing combat action¨
 */
export const combatActionIdAtom = atom<string | undefined>(undefined);

/**
 * Atom for managing any potential battle data
 */
export const userBattleAtom = atom<ReturnedBattle | undefined>(undefined);

/**
 * Context for managing user data and state.
 */
export const UserContext = createContext<{
  data: UserWithRelations;
  notifications: NavBarDropdownLink[] | undefined;
  status: string;
  pusher: Pusher | undefined;
  timeDiff: number;
}>({
  data: undefined,
  notifications: undefined,
  status: "unknown",
  pusher: undefined,
  timeDiff: 0,
});

/**
 * UserContextProvider component provides a context for managing user-related data and functionality.
 * It includes features such as managing Clerk token, Pusher connection, current user battle, time difference between client and server, and user data retrieval.
 *
 * @param props - The component props.
 * @param props.children - The child components.
 * @returns The UserContextProvider component.
 */
export function UserContextProvider(props: { children: React.ReactNode }) {
  // tRPC utility
  const utils = api.useUtils();
  // Clerk token
  const [token, setToken] = useState<string | null>(null);
  // Pusher connection
  const [pusher, setPusher] = useState<Pusher | undefined>(undefined);
  // Difference between client time and server time
  const [timeDiff, setTimeDiff] = useState<number>(0);
  // Get logged in user
  const { userId, sessionId, isSignedIn, isLoaded, getToken } = useAuth();
  // Set the token from clerk
  useEffect(() => {
    if (isSignedIn && isLoaded) {
      const fetch = async () => {
        setToken(await getToken());
      };
      fetch().catch(console.error);
    }
  }, [sessionId, isSignedIn, isLoaded, getToken]);
  // Get user data
  const { data: data, status: userStatus } = api.profile.getUser.useQuery(
    { token: token },
    {
      enabled: !!userId && isSignedIn && isLoaded && !!token,
      staleTime: Infinity,
      retry: false,
      refetchInterval: 300000,
    },
  );
  // Time diff setting
  useEffect(() => {
    if (data?.serverTime) {
      const discrepancy = Date.now() - data.serverTime;
      if (data.userData) {
        // Adjust updatedAt to client-time, effectively making client-time
        // seem the same as server-time, although server-time is still used
        // for all calculations
        data.userData.updatedAt = secondsFromDate(
          -discrepancy / 1000,
          data.userData.updatedAt,
        );
      }
      // Save the time-discrepancy between client and server for reference
      // e.g. in the battle system
      setTimeDiff(discrepancy);
    }
  }, [data?.userData, data?.serverTime]);
  // Listen on user channel for live updates on things
  useEffect(() => {
    if (userId) {
      // Pusher Channel
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER,
      });
      setPusher(pusher);
      const channel = pusher.subscribe(userId);
      channel.bind("event", async (data: UserEvent) => {
        if (data.type === "battle") {
          console.log("Received battle event");
        } else if (data.type === "newInbox") {
          console.log("Received inbox");
        } else if (data.type === "userMessage") {
          showMutationToast({
            success: true,
            message: data.message ?? "You have a new message",
            title: "Notification!",
            action: (
              <ToastAction altText="To Arena">
                <Link href={data.route ?? "/battlearena"}>
                  {data.routeText ?? "To Profile"}
                </Link>
              </ToastAction>
            ),
          });
        }
        await utils.invalidate();
      });
      return () => {
        pusher.unsubscribe(userId);
        pusher.disconnect();
      };
    }
  }, [userId, utils]);
  // Show user notifications in toast
  useEffect(() => {
    data?.notifications
      .filter((n) => n.color === "toast")
      .map((n) => {
        showMutationToast({
          success: true,
          message: <div>{parseHtml(n.name)}</div>,
          title: "Notification!",
        });
      });
  }, [data?.notifications]);

  return (
    <UserContext.Provider
      value={{
        data: data?.userData,
        notifications: data?.notifications,
        pusher: pusher,
        status: userStatus,
        timeDiff: timeDiff,
      }}
    >
      {props.children}
    </UserContext.Provider>
  );
}

// Events sent to the user from websockets
export type UserEvent = {
  type: string;
  message?: string;
  route?: string;
  routeText?: string;
};

// Easy hook for getting the current user data
export const useUserData = () => {
  return useContext(UserContext);
};

// Require the user to be logged in
export const useRequiredUserData = () => {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const info = useUserData();
  const { data, status } = info;
  useEffect(() => {
    if (isLoaded && status !== "pending" && (data === undefined || !isSignedIn)) {
      router.push("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data, isLoaded, isSignedIn]);
  return info;
};

/**
 * A hook which requires the user to be in their village,
 * otherwise redirect to the profile page. Can optionally be
 * narrowed further to a specific structure in the village
 */
export const useRequireInVillage = (structureRoute?: StructureRoute) => {
  // Access state
  const [access, setAccess] = useState<boolean>(false);
  // Get user information
  const { data: userData, timeDiff } = useRequiredUserData();
  // Get sector information based on user data
  const { data: sectorVillage, isPending } = api.travel.getVillageInSector.useQuery(
    { sector: userData?.sector ?? -1, isOutlaw: userData?.isOutlaw ?? false },
    { enabled: !!userData?.sector, staleTime: Infinity },
  );
  const ownVillage = userData?.village?.sector === sectorVillage?.sector;
  const router = useRouter();
  useEffect(() => {
    if (userData && sectorVillage && !isPending) {
      if (!userData.isOutlaw) {
        // Check structure access
        const access = canAccessStructure(userData, structureRoute, sectorVillage);
        // If not in village or village not exist
        const inVillage =
          calcIsInVillage({
            x: userData.longitude,
            y: userData.latitude,
          }) || sectorVillage.type === "SAFEZONE";
        // Redirect user
        if (!inVillage || !sectorVillage || !access) {
          console.log(inVillage, sectorVillage, access);
          void router.push("/");
        } else {
          setAccess(true);
        }
      } else {
        setAccess(true);
      }
    }
  }, [userData, sectorVillage, router, isPending, structureRoute, ownVillage]);
  return { userData, sectorVillage, ownVillage, timeDiff, access };
};
