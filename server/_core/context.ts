import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { updateUserProfile } from "../db";

// Track users whose premium expiry has already been processed (avoid repeated writes)
const premiumExpiryProcessed = new Set<number>();

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error: any) {
    // Authentication is optional for public procedures.
    // Log unexpected errors (not "no session" type errors) for debugging
    const msg = error?.message || "";
    if (msg && !msg.includes("No session") && !msg.includes("No cookies") && !msg.includes("Invalid session")) {
      console.error("[auth] Unexpected authentication error:", msg);
    }
    user = null;
  }

  // Enforce premium expiration: if premiumUntil is set and has passed, revoke premium
  if (user?.isPremium && user.premiumUntil && new Date(user.premiumUntil) < new Date()) {
    // Debounce: only fire write once per user (tracked in-memory)
    if (!premiumExpiryProcessed.has(user.id)) {
      const uid = user.id;
      premiumExpiryProcessed.add(uid);
      updateUserProfile(uid, { isPremium: false, premiumUntil: null } as any).catch(() => {
        premiumExpiryProcessed.delete(uid); // retry next request on failure
      });
    }
    user = { ...user, isPremium: false, premiumUntil: null };
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
