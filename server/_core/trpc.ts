import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ── Per-user mutation rate limiter ────────────────────────────────────────
const mutationAttempts = new Map<number, { count: number; resetAt: number }>();
const MAX_MUTATIONS_PER_MINUTE = 60;
const MUTATION_WINDOW_MS = 60 * 1000;
const MAX_RATE_LIMIT_ENTRIES = 50_000;

setInterval(() => {
  const now = Date.now();
  mutationAttempts.forEach((entry, userId) => {
    if (now >= entry.resetAt) mutationAttempts.delete(userId);
  });
  if (mutationAttempts.size > MAX_RATE_LIMIT_ENTRIES) {
    const toDelete = mutationAttempts.size - MAX_RATE_LIMIT_ENTRIES;
    const iter = mutationAttempts.keys();
    for (let i = 0; i < toDelete; i++) mutationAttempts.delete(iter.next().value!);
  }
}, 60_000).unref();

export function checkMutationRateLimit(userId: number): void {
  const now = Date.now();
  const entry = mutationAttempts.get(userId);
  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_MUTATIONS_PER_MINUTE) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please slow down.",
      });
    }
    entry.count++;
  } else {
    mutationAttempts.set(userId, { count: 1, resetAt: now + MUTATION_WINDOW_MS });
  }
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const rateLimitMutations = t.middleware(async opts => {
  const { ctx, next, type } = opts;
  if (type === "mutation" && ctx.user) {
    checkMutationRateLimit(ctx.user.id);
  }
  return next();
});

export const protectedProcedure = t.procedure.use(requireUser).use(rateLimitMutations);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin')) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
