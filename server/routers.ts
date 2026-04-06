import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { uploadFile, getSignedUrl } from "./storage";
import { sendRealtimeNotification, broadcastToGameRoom } from "./websocket";

// ── Email Transporter Singleton ────────────────────────────────────────────
let emailTransporterInstance: any = null;
let emailTransporterConfig: string = "";
async function getEmailTransporter(config: { host: string; port: number; user: string; pass: string }) {
  const configKey = `${config.host}:${config.port}:${config.user}`;
  if (emailTransporterInstance && emailTransporterConfig === configKey) return emailTransporterInstance;
  const { default: nodemailer } = await import("nodemailer");
  emailTransporterInstance = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
  emailTransporterConfig = configKey;
  return emailTransporterInstance;
}

// ── Rate Limiting (in-memory, per IP for login) ──────────────────────────
// Mutation rate limiting is applied universally via tRPC middleware in _core/trpc.ts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RATE_LIMIT_ENTRIES = 50_000; // Cap to prevent OOM under attack

// Periodically clean up expired login rate limit entries
setInterval(() => {
  const now = Date.now();
  loginAttempts.forEach((entry, ip) => {
    if (now >= entry.resetAt) loginAttempts.delete(ip);
  });
  if (loginAttempts.size > MAX_RATE_LIMIT_ENTRIES) {
    const toDelete = loginAttempts.size - MAX_RATE_LIMIT_ENTRIES;
    let deleted = 0;
    for (const key of Array.from(loginAttempts.keys())) {
      if (deleted >= toDelete) break;
      loginAttempts.delete(key);
      deleted++;
    }
  }
}, 60_000).unref();

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_LOGIN_ATTEMPTS) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many login attempts. Please try again in 15 minutes.",
      });
    }
    entry.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  }
}

// ── Input Sanitization ────────────────────────────────────────────────────
// NOTE: React escapes all rendered output by default, so HTML-encoding on input
// is unnecessary and causes double-encoding (e.g. "AT&T" → "AT&amp;T" in DB).
// We strip control characters, HTML tags (defense-in-depth), and trim whitespace.
function sanitizeString(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
}

export const appRouter = router({
  system: systemRouter,

  // ── Auth ────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => {
      if (opts.ctx.user) {
        db.updateLoginStreak(opts.ctx.user.id).catch(() => {});
        return db.sanitizeUser(opts.ctx.user);
      }
      return null;
    }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(6).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        checkRateLimit(ip);
        const normalizedEmail = input.email.toLowerCase().trim();
        const user = await db.authenticateUser(normalizedEmail, input.password);
        if (!user) return { success: false, error: "Invalid credentials" } as const;
        // Update login streak
        db.updateLoginStreak(user.id).catch(() => {});
        // Set session cookie for email-based auth
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.username || "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, user: db.sanitizeUser(user) } as const;
      }),
    signup: publicProcedure
      .input(z.object({
        email: z.string().email(),
        username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, dots, hyphens, and underscores"),
        password: z.string().min(8).max(128),
        name: z.string().max(100).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        checkRateLimit(ip);
        const normalizedEmail = input.email.toLowerCase().trim();
        const existing = await db.getUserByEmail(normalizedEmail);
        if (existing) return { success: false, error: "Email already registered" } as const;
        const existingUsername = await db.getUserByUsername(input.username);
        if (existingUsername) return { success: false, error: "Username already taken" } as const;
        const sanitizedInput = {
          ...input,
          email: normalizedEmail,
          name: input.name ? sanitizeString(input.name) : undefined,
        };
        const user = await db.createUserWithPassword(sanitizedInput);
        if (!user) return { success: false, error: "Failed to create account" } as const;
        // Set session cookie for newly created user
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.username || "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, user: db.sanitizeUser(user) } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        checkRateLimit(ip);
        const user = await db.getUserByEmail(input.email.toLowerCase().trim());
        if (!user) {
          // Return success even if email not found to prevent email enumeration
          return { success: true, message: "If an account exists with this email, a reset link has been sent." };
        }
        const { randomBytes } = await import("crypto");
        const token = randomBytes(32).toString("hex");
        await db.createPasswordResetToken(user.id, token);
        // In production, send email with reset link containing the token
        // await sendEmail(user.email, { subject: "Password Reset", ... });
        console.log(`[Auth] Password reset token created for user ${user.id} at ${new Date().toISOString()}`);
        return { success: true, message: "If an account exists with this email, a reset link has been sent." };
      }),
    resetPassword: publicProcedure
      .input(z.object({ token: z.string(), newPassword: z.string().min(8).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        checkRateLimit(ip);
        const userId = await db.verifyPasswordResetToken(input.token);
        if (!userId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset token" });
        }
        const { randomBytes, scryptSync } = await import("crypto");
        const salt = randomBytes(16).toString("hex");
        const derivedKey = scryptSync(input.newPassword, salt, 64).toString("hex");
        await db.resetUserPassword(userId, `${salt}:${derivedKey}`);
        return { success: true };
      }),
  }),

  // ── Users ───────────────────────────────────────────────────────────────
  users: router({
    getProfile: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Allow viewing own profile always
        if (input.userId !== ctx.user.id) {
          const blocked = await db.isBlocked(ctx.user.id, input.userId);
          if (blocked) return null;
        }
        const user = await db.getUserById(input.userId);
        return user ? db.sanitizeUser(user) : null;
      }),
    getEndorsements: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => db.getEndorsementsSummary(input.userId)),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        nickname: z.string().optional(),
        showFullName: z.boolean().optional(),
        bio: z.string().optional(),
        skillLevel: z.string().optional(),
        vibe: z.enum(["competitive", "social", "both"]).optional(),
        pace: z.enum(["fast", "rally", "both"]).optional(),
        playStyle: z.string().optional(),
        handedness: z.enum(["left", "right", "ambidextrous"]).optional(),
        goals: z.string().optional(),
        courtPreference: z.enum(["indoor", "outdoor", "both"]).optional(),
        profilePhotoUrl: z.string().nullable().optional(),
        hasProfilePhoto: z.boolean().optional(),
        e2ePublicKey: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        const sanitized = { ...input };
        if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
        if (sanitized.nickname) sanitized.nickname = sanitizeString(sanitized.nickname);
        if (sanitized.bio) sanitized.bio = sanitizeString(sanitized.bio);
        if (sanitized.goals) sanitized.goals = sanitizeString(sanitized.goals);
        if (sanitized.playStyle) sanitized.playStyle = sanitizeString(sanitized.playStyle);
        const result = db.updateUserProfile(ctx.user.id, sanitized);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    getNearby: protectedProcedure
      .input(z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusMiles: z.number().min(1).max(500).default(25),
        minRating: z.number().min(0).max(5).optional(),
        maxRating: z.number().min(0).max(5).optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Use travel mode location if set
        const me = await db.getUserById(ctx.user.id);
        const lat = me?.travelModeLat ?? input.lat;
        const lng = me?.travelModeLng ?? input.lng;
        // Rating filters are premium-only
        const opts = me?.isPremium ? { minRating: input.minRating, maxRating: input.maxRating } : undefined;
        return db.getNearbyUsersWithDistance(ctx.user.id, lat, lng, input.radiusMiles, opts);
      }),
    updateLocation: protectedProcedure
      .input(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), city: z.string().optional() }))
      .mutation(({ ctx, input }) => db.updateUserLocation(ctx.user.id, input.lat, input.lng, input.city ? sanitizeString(input.city) : input.city)),
    toggleGhostMode: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user?.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Premium feature: Ghost Mode" });
        await db.toggleGhostMode(ctx.user.id, input.enabled);
        return { ghostMode: input.enabled };
      }),
    toggleReadReceipts: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user?.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Premium feature: Read Receipts" });
        await db.updateUserProfile(ctx.user.id, { readReceipts: input.enabled });
        return { readReceipts: input.enabled };
      }),
    setTravelMode: protectedProcedure
      .input(z.object({ lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable(), city: z.string().nullable() })
        .refine(d => (d.lat !== null && d.lng !== null) || (d.lat === null && d.lng === null), "Both lat and lng must be set or both must be null"))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user?.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Premium feature: Travel Mode" });
        const city = input.city ? sanitizeString(input.city) : input.city;
        await db.setTravelMode(ctx.user.id, input.lat, input.lng, city);
        return { travelModeCity: city };
      }),
    completeOnboarding: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        nickname: z.string().optional(),
        dateOfBirth: z.string().optional(),
        skillLevel: z.string().optional(),
        vibe: z.enum(["competitive", "social", "both"]).optional(),
        pace: z.enum(["fast", "rally", "both"]).optional(),
        playStyle: z.string().optional(),
        goals: z.string().optional(),
        courtPreference: z.enum(["indoor", "outdoor", "both"]).optional(),
        handedness: z.enum(["left", "right", "ambidextrous"]).optional(),
        gender: z.enum(["male", "female", "non-binary", "prefer-not-to-say"]).optional(),
        availabilityWeekdays: z.boolean().optional(),
        availabilityWeekends: z.boolean().optional(),
        availabilityMornings: z.boolean().optional(),
        availabilityAfternoons: z.boolean().optional(),
        availabilityEvenings: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sanitized = { ...input } as any;
        if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
        if (sanitized.nickname) sanitized.nickname = sanitizeString(sanitized.nickname);
        if (sanitized.goals) sanitized.goals = sanitizeString(sanitized.goals);
        if (sanitized.playStyle) sanitized.playStyle = sanitizeString(sanitized.playStyle);
        // Compute age from dateOfBirth
        if (sanitized.dateOfBirth) {
          const dob = new Date(sanitized.dateOfBirth);
          const ageDiff = Date.now() - dob.getTime();
          const ageDate = new Date(ageDiff);
          const age = Math.abs(ageDate.getUTCFullYear() - 1970);
          if (age < 18) throw new TRPCError({ code: "BAD_REQUEST", message: "You must be at least 18 years old to use PKL Court Connect" });
          sanitized.age = age;
          sanitized.dateOfBirth = dob;
        }
        await db.completeOnboarding(ctx.user.id, sanitized);
        // Award Rookie Ready badge
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
      }),
  }),

  // ── Swipes ──────────────────────────────────────────────────────────────
  swipes: router({
    create: protectedProcedure
      .input(z.object({ swipedId: z.number(), direction: z.enum(["rally", "pass"]), isSuperRally: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.swipedId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot swipe on yourself" });
        }
        // Super Rally requires premium + 1 per day server-side limit
        if (input.isSuperRally) {
          const user = await db.getUserById(ctx.user.id);
          if (!user?.isPremium) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Super Rally is a premium feature" });
          }
          const todayCount = await db.getSuperRallyCountToday(ctx.user.id);
          if (todayCount >= 1) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You can only use 1 Super Rally per day" });
          }
        }
        try {
          const result = await db.createSwipe(ctx.user.id, input.swipedId, input.direction, input.isSuperRally);
          // Create notifications for new match
          if (result.matched) {
            db.createNotification(input.swipedId, { type: "match", title: "New Match!", content: "You have a new match! Start chatting.", link: "matches", targetId: result.conversationId }).catch(() => {});
            db.createNotification(ctx.user.id, { type: "match", title: "It's a Rally!", content: "You matched! Say hello.", link: "matches", targetId: result.conversationId }).catch(() => {});
            // Send real-time match notification to the OTHER user (so they see the celebration)
            const swiper = await db.getUserById(ctx.user.id);
            if (swiper) {
              sendRealtimeNotification(input.swipedId, {
                type: "match",
                title: "It's a Rally! 🏓",
                body: `You and ${swiper.name || swiper.nickname || "someone"} want to play!`,
                matchedUser: {
                  id: swiper.id,
                  name: swiper.name,
                  nickname: swiper.nickname,
                  profilePhotoUrl: swiper.profilePhotoUrl,
                  hasProfilePhoto: !!swiper.profilePhotoUrl,
                },
              });
            }
          }
          // Check achievements after swipe (may have created a match)
          db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
          return result;
        } catch (e: any) {
          if (e.code === "ER_DUP_ENTRY" || e.message?.includes("Duplicate") || e.message?.includes("idx_swipes_pair")) {
            throw new TRPCError({ code: "CONFLICT", message: "Already swiped on this player" });
          }
          // Don't expose raw SQL errors to client
          console.error("[Swipe Error]", e.message);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to process swipe" });
        }
      }),
    remaining: protectedProcedure
      .query(({ ctx }) => db.getSwipesRemaining(ctx.user.id)),
    candidates: protectedProcedure
      .input(z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusMiles: z.number().min(1).max(500).default(25),
        skillLevel: z.string().optional(),
        ageMin: z.number().min(18).max(99).optional(),
        ageMax: z.number().min(18).max(99).optional(),
        vibe: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const me = await db.getUserById(ctx.user.id);
        const lat = me?.travelModeLat ?? input.lat;
        const lng = me?.travelModeLng ?? input.lng;
        // Premium filters: ageMin/ageMax/skillLevel gated to premium
        const filters: any = {};
        if (input.vibe) filters.vibe = input.vibe;
        if (me?.isPremium) {
          if (input.skillLevel) filters.skillLevel = input.skillLevel;
          if (input.ageMin) filters.ageMin = input.ageMin;
          if (input.ageMax) filters.ageMax = input.ageMax;
        }
        return db.getSwipeCandidates(ctx.user.id, lat, lng, input.radiusMiles, filters);
      }),
    whoLikedYou: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user?.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Premium feature: See Who Liked You" });
        return db.getWhoLikedYou(ctx.user.id);
      }),
    boost: protectedProcedure
      .mutation(({ ctx }) => db.activateProfileBoost(ctx.user.id)),
    undo: protectedProcedure
      .mutation(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user?.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Premium feature: Undo Last Swipe" });
        return db.undoLastSwipe(ctx.user.id);
      }),
  }),

  // ── Matches ─────────────────────────────────────────────────────────────
  matches: router({
    list: protectedProcedure
      .query(({ ctx }) => db.getUserMatchesEnriched(ctx.user.id)),
    unmatch: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(({ ctx, input }) => db.unmatch(ctx.user.id, input.matchId)),
    getUnmatched: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Premium feature" });
        return db.getUnmatchedUsers(ctx.user.id);
      }),
    rematch: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Premium feature" });
        return db.rematchUser(ctx.user.id, input.matchId);
      }),
  }),

  // ── Messages / Chat ────────────────────────────────────────────────────
  chat: router({
    getConversations: protectedProcedure
      .input(z.object({ cursor: z.number().optional(), limit: z.number().min(1).max(100).default(50) }).optional())
      .query(({ ctx, input }) => db.getUserConversations(ctx.user.id, input?.limit ?? 50, input?.cursor)),
    startDirectMessage: protectedProcedure
      .input(z.object({ targetUserId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.targetUserId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot message yourself" });
        // Premium-only feature
        const sender = await db.getUserById(ctx.user.id);
        if (!sender?.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Direct messaging is a premium feature" });
        // Check if target has blocked sender
        const blocked = await db.isBlocked(ctx.user.id, input.targetUserId);
        if (blocked) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot message this user" });
        return db.getOrCreateDirectConversation(ctx.user.id, input.targetUserId);
      }),
    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number(), cursor: z.number().optional(), limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        if (!await db.isConversationParticipant(ctx.user.id, input.conversationId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant in this conversation" });
        }
        return db.getMessagesEnriched(input.conversationId, input.limit, input.cursor);
      }),
    getParticipants: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!await db.isConversationParticipant(ctx.user.id, input.conversationId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant in this conversation" });
        }
        return db.getConversationParticipants(input.conversationId);
      }),
    sendMessage: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        content: z.string().max(5000).optional(),
        messageType: z.enum(["text", "image", "video", "location_pin", "system"]).default("text"),
        locationLat: z.number().optional(),
        locationLng: z.number().optional(),
        locationName: z.string().max(255).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!await db.isConversationParticipant(ctx.user.id, input.conversationId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant in this conversation" });
        }
        const sanitized = { ...input };
        if (sanitized.content) sanitized.content = sanitizeString(sanitized.content);
        if (sanitized.locationName) sanitized.locationName = sanitizeString(sanitized.locationName);
        // Text messages must have content; image/location_pin can omit it
        if (sanitized.messageType === "text" && (!sanitized.content || sanitized.content.length === 0)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Message content is required" });
        }
        const result = await db.sendMessage(ctx.user.id, sanitized);
        // Broadcast via socket for instant delivery to other participants
        const io = (global as any).__socketIO;
        if (io) {
          io.to(`conversation:${input.conversationId}`).emit("chat:message", {
            ...(result || {}),
            conversationId: input.conversationId,
            content: sanitized.content,
            messageType: sanitized.messageType || "text",
            senderId: ctx.user.id,
          });
        }
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    markRead: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!await db.isConversationParticipant(ctx.user.id, input.conversationId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant in this conversation" });
        }
        return db.markConversationRead(ctx.user.id, input.conversationId);
      }),
    getReadStatus: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!await db.isConversationParticipant(ctx.user.id, input.conversationId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant in this conversation" });
        }
        // Only premium users with readReceipts can see read status
        const user = await db.getUserById(ctx.user.id);
        if (!user?.isPremium || !user?.readReceipts) return { enabled: false, participants: [] };
        const participants = await db.getConversationParticipants(input.conversationId);
        return { enabled: true, participants };
      }),
    addReaction: protectedProcedure
      .input(z.object({ messageId: z.number(), emoji: z.string().min(1).max(8) }))
      .mutation(({ ctx, input }) => db.addMessageReaction(ctx.user.id, input.messageId, input.emoji)),
    removeReaction: protectedProcedure
      .input(z.object({ messageId: z.number(), emoji: z.string().min(1).max(8) }))
      .mutation(({ ctx, input }) => db.removeMessageReaction(ctx.user.id, input.messageId, input.emoji)),
    getReactions: protectedProcedure
      .input(z.object({ messageIds: z.array(z.number()).min(1).max(100) }))
      .query(({ ctx, input }) => db.getMessageReactions(input.messageIds)),
  }),

  // ── Courts ──────────────────────────────────────────────────────────────
  courts: router({
    list: publicProcedure
      .input(z.object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        radiusMiles: z.number().min(1).max(500).default(25),
        courtType: z.enum(["indoor", "outdoor", "both"]).optional(),
        isFree: z.boolean().optional(),
      }).optional())
      .query(({ input }) => db.getCourts(input)),
    getById: publicProcedure
      .input(z.object({ courtId: z.number() }))
      .query(({ input }) => db.getCourtById(input.courtId)),
    getReviews: publicProcedure
      .input(z.object({ courtId: z.number() }))
      .query(({ input }) => db.getCourtReviews(input.courtId)),
    addReview: protectedProcedure
      .input(z.object({ courtId: z.number(), rating: z.number().min(1).max(5), comment: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const sanitized = { ...input };
        if (sanitized.comment) sanitized.comment = sanitizeString(sanitized.comment);
        const result = await db.addCourtReview(ctx.user.id, sanitized);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    // Court submissions (user-submitted courts)
    submit: protectedProcedure
      .input(z.object({
        name: z.string().min(2).max(255),
        address: z.string().max(500).optional(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        courtType: z.enum(["indoor", "outdoor", "both"]).default("outdoor"),
        numCourts: z.number().min(1).max(50).default(1),
        surfaceType: z.string().max(50).optional(),
        lighting: z.boolean().default(false),
        isFree: z.boolean().default(true),
        costInfo: z.string().max(200).optional(),
        amenities: z.string().max(500).optional(),
        photoUrl: z.string().max(1000).optional(),
        notes: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sanitized = { ...input };
        if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
        if (sanitized.address) sanitized.address = sanitizeString(sanitized.address);
        if (sanitized.notes) sanitized.notes = sanitizeString(sanitized.notes);
        if (sanitized.costInfo) sanitized.costInfo = sanitizeString(sanitized.costInfo);
        if (sanitized.amenities) sanitized.amenities = sanitizeString(sanitized.amenities);
        if (sanitized.city) sanitized.city = sanitizeString(sanitized.city);
        if (sanitized.state) sanitized.state = sanitizeString(sanitized.state);
        if (sanitized.surfaceType) sanitized.surfaceType = sanitizeString(sanitized.surfaceType);
        const result = await db.submitCourt(ctx.user.id, sanitized);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    mySubmissions: protectedProcedure
      .query(({ ctx }) => db.getUserCourtSubmissions(ctx.user.id)),
    pendingSubmissions: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        }
        return db.getPendingCourtSubmissions();
      }),
    reviewSubmission: protectedProcedure
      .input(z.object({
        submissionId: z.number(),
        action: z.enum(["approved", "rejected"]),
        adminNotes: z.string().max(500).optional(),
        // Admin can edit any field before approving
        name: z.string().min(2).max(255).optional(),
        address: z.string().max(500).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        courtType: z.enum(["indoor", "outdoor", "both"]).optional(),
        numCourts: z.number().min(1).max(50).optional(),
        surfaceType: z.string().max(50).optional(),
        lighting: z.boolean().optional(),
        isFree: z.boolean().optional(),
        costInfo: z.string().max(200).optional(),
        amenities: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        }
        const sanitized = { ...input };
        if (sanitized.adminNotes) sanitized.adminNotes = sanitizeString(sanitized.adminNotes);
        if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
        if (sanitized.address) sanitized.address = sanitizeString(sanitized.address);
        if (sanitized.city) sanitized.city = sanitizeString(sanitized.city);
        if (sanitized.state) sanitized.state = sanitizeString(sanitized.state);
        if (sanitized.surfaceType) sanitized.surfaceType = sanitizeString(sanitized.surfaceType);
        if (sanitized.costInfo) sanitized.costInfo = sanitizeString(sanitized.costInfo);
        if (sanitized.amenities) sanitized.amenities = sanitizeString(sanitized.amenities);
        return db.reviewCourtSubmission(ctx.user.id, sanitized);
      }),
    // Court photos
    getPhotos: publicProcedure
      .input(z.object({ courtId: z.number() }))
      .query(({ input }) => db.getCourtPhotos(input.courtId)),
    addPhoto: protectedProcedure
      .input(z.object({ courtId: z.number(), photoUrl: z.string().max(1000), caption: z.string().max(255).optional() }))
      .mutation(async ({ ctx, input }) => {
        const sanitized = { ...input };
        if (sanitized.caption) sanitized.caption = sanitizeString(sanitized.caption);
        return db.addCourtPhoto(ctx.user.id, input.courtId, input.photoUrl, sanitized.caption);
      }),
    deletePhoto: protectedProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(({ ctx, input }) => db.deleteCourtPhoto(ctx.user.id, input.photoId)),
    // Court leaderboard (King of the Court)
    leaderboard: publicProcedure
      .input(z.object({ courtId: z.number() }))
      .query(({ input }) => db.getCourtLeaderboard(input.courtId)),
    // Court bookings
    getBookings: protectedProcedure
      .input(z.object({ courtId: z.number(), startDate: z.string().optional(), endDate: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const bookings = await db.getCourtBookings(input.courtId, input.startDate ? new Date(input.startDate) : undefined, input.endDate ? new Date(input.endDate) : undefined);
        return bookings.map(b => ({ ...b, isOwn: b.userId === ctx.user.id }));
      }),
    createBooking: protectedProcedure
      .input(z.object({
        courtId: z.number(),
        startTime: z.string(),
        endTime: z.string(),
        courtNumber: z.number().min(1).max(50).optional(),
        gameId: z.number().optional(),
        notes: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sanitized = { ...input, startTime: new Date(input.startTime), endTime: new Date(input.endTime) };
        if (input.notes) sanitized.notes = sanitizeString(input.notes);
        return db.createCourtBooking(ctx.user.id, sanitized);
      }),
    cancelBooking: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(({ ctx, input }) => db.cancelCourtBooking(ctx.user.id, input.bookingId)),
    myBookings: protectedProcedure
      .query(({ ctx }) => db.getUserBookings(ctx.user.id)),
  }),

  // ── Games ───────────────────────────────────────────────────────────────
  games: router({
    list: protectedProcedure
      .input(z.object({ status: z.enum(["scheduled", "in-progress", "completed", "cancelled"]).optional() }).optional())
      .query(({ ctx, input }) => db.getUserGamesEnriched(ctx.user.id, input?.status)),
    listByGroup: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const group = await db.getGroupById(input.groupId);
        if (group?.isPrivate && !await db.isGroupMember(ctx.user.id, input.groupId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only group members can view games of a private group" });
        }
        return db.getGroupGames(input.groupId);
      }),
    upcoming: protectedProcedure
      .input(z.object({ lat: z.number().optional(), lng: z.number().optional() }).optional())
      .query(({ ctx, input }) => db.getUpcomingGames(ctx.user.id, input?.lat, input?.lng)),
    create: protectedProcedure
      .input(z.object({
        courtId: z.number().optional(),
        locationLat: z.number().min(-90).max(90).optional(),
        locationLng: z.number().min(-180).max(180).optional(),
        locationName: z.string().max(255).optional(),
        scheduledAt: z.string(),
        durationMinutes: z.number().min(15).max(480).default(90),
        gameType: z.enum(["casual", "competitive", "tournament", "practice"]).default("casual"),
        format: z.enum(["singles", "mens-doubles", "womens-doubles", "mixed-doubles"]).default("mixed-doubles"),
        maxPlayers: z.number().min(2).max(32).default(4),
        skillLevelMin: z.string().optional(),
        skillLevelMax: z.string().optional(),
        notes: z.string().max(500).optional(),
        isOpen: z.boolean().default(true),
        groupId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate court exists if provided
        if (input.courtId) {
          const court = await db.getCourtById(input.courtId);
          if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Court not found" });
        }
        // Validate scheduled date is in the future
        const scheduledDate = new Date(input.scheduledAt);
        if (isNaN(scheduledDate.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid date" });
        if (scheduledDate < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Game must be scheduled in the future" });
        // Validate skill level ordering
        const skillOrder = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0"];
        if (input.skillLevelMin && input.skillLevelMax) {
          const minIdx = skillOrder.indexOf(input.skillLevelMin);
          const maxIdx = skillOrder.indexOf(input.skillLevelMax);
          if (minIdx !== -1 && maxIdx !== -1 && minIdx > maxIdx) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum skill level cannot exceed maximum" });
          }
        }
        // Validate format/maxPlayers consistency
        if (input.format === "singles" && input.maxPlayers > 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Singles format allows a maximum of 2 players" });
        }
        const sanitized = { ...input };
        if (sanitized.locationName) sanitized.locationName = sanitizeString(sanitized.locationName);
        if (sanitized.notes) sanitized.notes = sanitizeString(sanitized.notes);
        const result = await db.createGame(ctx.user.id, sanitized);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    join: protectedProcedure
      .input(z.object({ gameId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.joinGame(ctx.user.id, input.gameId);
        // Notify the game organizer
        const game = await db.getGameById(input.gameId);
        if (game && game.organizerId !== ctx.user.id) {
          const joiner = await db.getUserById(ctx.user.id);
          const joinerName = joiner?.name || joiner?.nickname || "Someone";
          db.createNotification(game.organizerId, {
            type: "game_invite",
            title: `${joinerName} joined your game!`,
            link: `/game/${input.gameId}`,
            targetId: input.gameId,
          }).catch(() => {});
          sendRealtimeNotification(game.organizerId, {
            type: "game_invite",
            title: `${joinerName} joined your game! 🏓`,
            body: "Tap to view the game",
            gameId: input.gameId,
          });
        }
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    approveParticipant: protectedProcedure
      .input(z.object({ gameId: z.number(), userId: z.number() }))
      .mutation(({ ctx, input }) => db.approveGameParticipant(ctx.user.id, input.gameId, input.userId)),
    declineParticipant: protectedProcedure
      .input(z.object({ gameId: z.number(), userId: z.number() }))
      .mutation(({ ctx, input }) => db.declineGameParticipant(ctx.user.id, input.gameId, input.userId)),
    leave: protectedProcedure
      .input(z.object({ gameId: z.number() }))
      .mutation(({ ctx, input }) => db.leaveGame(ctx.user.id, input.gameId)),
    update: protectedProcedure
      .input(z.object({
        gameId: z.number(),
        status: z.enum(["scheduled", "in-progress", "completed", "cancelled"]).optional(),
        notes: z.string().max(2000).optional(),
        maxPlayers: z.number().min(2).max(32).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate state transitions if status is being changed
        const game = await db.getGameById(input.gameId);
        if (!game) throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
        if (game.organizerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the organizer can update this game" });
        if (input.status) {
          const VALID_TRANSITIONS: Record<string, string[]> = {
            "scheduled": ["in-progress", "cancelled"],
            "in-progress": ["completed", "cancelled"],
            "completed": [],
            "cancelled": [],
          };
          const currentStatus = game.status as string;
          if (VALID_TRANSITIONS[currentStatus] && !VALID_TRANSITIONS[currentStatus].includes(input.status)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot transition from '${currentStatus}' to '${input.status}'` });
          }
        }
        const sanitized = { ...input };
        if (sanitized.notes) sanitized.notes = sanitizeString(sanitized.notes);
        return db.updateGame(ctx.user.id, input.gameId, sanitized);
      }),
    giveFeedback: protectedProcedure
      .input(z.object({
        gameId: z.number(),
        reviewedId: z.number(),
        rating: z.number().min(1).max(5),
        skillAccurate: z.boolean().default(true),
        goodSport: z.boolean().default(true),
        onTime: z.boolean().default(true),
        wouldPlayAgain: z.boolean().default(true),
        comment: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.reviewedId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot rate yourself" });
        }
        if (!await db.isGameParticipant(ctx.user.id, input.gameId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You must be a participant to give feedback" });
        }
        if (!await db.isGameParticipant(input.reviewedId, input.gameId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Reviewed user was not in this game" });
        }
        const sanitized = { ...input };
        if (sanitized.comment) sanitized.comment = sanitizeString(sanitized.comment);
        const result = await db.giveGameFeedback(ctx.user.id, sanitized);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    recordResult: protectedProcedure
      .input(z.object({
        gameId: z.number(),
        team1Score: z.number().min(0).max(99),
        team2Score: z.number().min(0).max(99),
        team1PlayerIds: z.array(z.number()).min(1).max(16),
        team2PlayerIds: z.array(z.number()).min(1).max(16),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only game participants can record results
        const existing = await db.getGameResult(input.gameId);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Results already recorded for this game" });
        }
        if (!await db.isGameParticipant(ctx.user.id, input.gameId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only game participants can record results" });
        }
        // Validate all referenced players are actual game participants
        const allPlayerIds = Array.from(new Set([...input.team1PlayerIds, ...input.team2PlayerIds]));
        for (const pid of allPlayerIds) {
          if (!await db.isGameParticipant(pid, input.gameId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Player ${pid} is not a participant in this game` });
          }
        }
        const result = await db.recordGameResult(ctx.user.id, input);
        // Award XP and check achievements for all participants
        for (const playerId of allPlayerIds) {
          db.addXp(playerId, 25).catch(() => {}); // participation XP
          db.checkAndAwardAchievements(playerId).catch(() => {});
        }
        return result;
      }),
    getResult: protectedProcedure
      .input(z.object({ gameId: z.number() }))
      .query(({ input }) => db.getGameResult(input.gameId)),
    confirmScore: protectedProcedure
      .input(z.object({ gameId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!await db.isGameParticipant(ctx.user.id, input.gameId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only game participants can confirm scores" });
        }
        return db.confirmGameScore(ctx.user.id, input.gameId);
      }),
    disputeScore: protectedProcedure
      .input(z.object({ gameId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!await db.isGameParticipant(ctx.user.id, input.gameId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only game participants can dispute scores" });
        }
        return db.disputeGameScore(ctx.user.id, input.gameId);
      }),
    start: protectedProcedure
      .input(z.object({
        gameId: z.number(),
        pointsToWin: z.number().min(1).max(21).optional(),
        bestOf: z.number().min(1).max(5).optional(),
        winBy: z.number().min(1).max(5).optional(),
      }))
      .mutation(({ ctx, input }) => db.startGame(ctx.user.id, input.gameId, {
        pointsToWin: input.pointsToWin,
        bestOf: input.bestOf,
        winBy: input.winBy,
      })),
    startWithTeams: protectedProcedure
      .input(z.object({
        gameId: z.number(),
        team1PlayerIds: z.array(z.number()).min(1).max(16),
        team2PlayerIds: z.array(z.number()).min(1).max(16),
        pointsToWin: z.number().min(1).max(21).optional(),
        bestOf: z.number().min(1).max(5).optional(),
        winBy: z.number().min(1).max(5).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.startGameWithTeams(ctx.user.id, input.gameId, input.team1PlayerIds, input.team2PlayerIds, {
          pointsToWin: input.pointsToWin,
          bestOf: input.bestOf,
          winBy: input.winBy,
        });
        // Notify all participants (except organizer) that game has started
        const allPlayerIds = Array.from(new Set([...input.team1PlayerIds, ...input.team2PlayerIds]));
        for (const playerId of allPlayerIds) {
          if (playerId !== ctx.user.id) {
            sendRealtimeNotification(playerId, {
              title: "Game Started!",
              body: "A game you're in has started. Tap to view scores.",
              type: "game_invite",
              gameId: input.gameId,
            });
            db.createNotification(playerId, {
              type: "game_invite",
              title: "Your game has started! Tap to view and score.",
              link: `/game/${input.gameId}`,
              targetId: input.gameId,
            }).catch(() => {});
          }
        }
        return result;
      }),
    saveTeams: protectedProcedure
      .input(z.object({
        gameId: z.number(),
        team1PlayerIds: z.array(z.number()).min(1),
        team2PlayerIds: z.array(z.number()).min(1),
      }))
      .mutation(({ ctx, input }) => db.saveTeamAssignments(ctx.user.id, input.gameId, input.team1PlayerIds, input.team2PlayerIds)),
    saveRound: protectedProcedure
      .input(z.object({
        gameId: z.number(),
        roundNumber: z.number().min(1).max(5),
        team1Score: z.number().min(0).max(99),
        team2Score: z.number().min(0).max(99),
        winnerTeam: z.enum(["team1", "team2"]).optional(),
        completed: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.saveGameRound(ctx.user.id, input.gameId, input);
        // Broadcast round update to all players in the game room
        if (input.completed && input.winnerTeam) {
          broadcastToGameRoom(input.gameId, "game:roundComplete", {
            gameId: input.gameId,
            roundNumber: input.roundNumber,
            team1Score: input.team1Score,
            team2Score: input.team2Score,
            winnerTeam: input.winnerTeam,
          });
        }
        return result;
      }),
    getRounds: protectedProcedure
      .input(z.object({ gameId: z.number() }))
      .query(({ ctx, input }) => db.getGameRounds(ctx.user.id, input.gameId)),
    complete: protectedProcedure
      .input(z.object({
        gameId: z.number(),
        team1Score: z.number().min(0).max(99),
        team2Score: z.number().min(0).max(99),
        team1PlayerIds: z.array(z.number()).min(1),
        team2PlayerIds: z.array(z.number()).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.completeGame(ctx.user.id, input.gameId, input);
        // Broadcast game completion to all players in the game room for instant UI update
        broadcastToGameRoom(input.gameId, "game:completed", {
          gameId: input.gameId,
          team1Score: input.team1Score,
          team2Score: input.team2Score,
        });
        // Notify all participants that the game is complete
        const allPlayerIds = Array.from(new Set([...input.team1PlayerIds, ...input.team2PlayerIds]));
        const winnerTeam = input.team1Score > input.team2Score ? "team1" : "team2";
        for (const playerId of allPlayerIds) {
          if (playerId !== ctx.user.id) {
            const isWinner = (winnerTeam === "team1" && input.team1PlayerIds.includes(playerId))
              || (winnerTeam === "team2" && input.team2PlayerIds.includes(playerId));
            sendRealtimeNotification(playerId, {
              type: "game_invite",
              title: isWinner ? "Victory! 🏆" : "Game Complete",
              body: `Final score: ${input.team1Score} - ${input.team2Score}`,
              gameId: input.gameId,
            });
            db.createNotification(playerId, {
              type: "game_invite",
              title: isWinner ? "You won! 🏆" : "Game Complete",
              content: `Final score: ${input.team1Score} - ${input.team2Score}`,
              link: `/game/${input.gameId}`,
              targetId: input.gameId,
            }).catch(() => {});
          }
        }
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    scoreboard: protectedProcedure
      .input(z.object({ gameId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!await db.isGameParticipant(ctx.user.id, input.gameId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only game participants can view the scoreboard" });
        }
        return db.getGameScoreboard(input.gameId);
      }),
  }),

  // ── Achievements ────────────────────────────────────────────────────────
  achievements: router({
    list: protectedProcedure
      .query(({ ctx }) => db.getUserAchievementsEnriched(ctx.user.id)),
    forUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (await db.isBlocked(ctx.user.id, input.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot view this user's achievements" });
        }
        return db.getUserAchievementsEnriched(input.userId);
      }),
    all: publicProcedure
      .query(() => db.getAllAchievements()),
    check: protectedProcedure
      .mutation(async ({ ctx }) => {
        const awarded = await db.checkAndAwardAchievements(ctx.user.id);
        return { awarded };
      }),
    claim: protectedProcedure
      .input(z.object({ achievementId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.claimAchievement(ctx.user.id, input.achievementId);
        if (!result.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.reason ?? "Claim failed" });
        }
        return { xpAwarded: result.xpAwarded };
      }),
    claimQuest: protectedProcedure
      .input(z.object({ questId: z.string(), xp: z.number().min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        // Server-side quest XP validation — prevent clients from sending arbitrary XP
        const VALID_QUESTS: Record<string, number> = {
          "q1": 50,  // Daily Login
          "q2": 30,  // Swipe 5 Players
          "q3": 25,  // Send a Message
          "q4": 100, // Play a Game
        };
        const baseXp = VALID_QUESTS[input.questId];
        if (baseXp === undefined) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid quest ID" });
        }
        // addXp handles premium 2x and Double XP Weekend multipliers
        const result = await db.claimDailyQuest(ctx.user.id, input.questId, baseXp);
        if (result.alreadyClaimed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Quest already claimed today" });
        }
        return { success: true };
      }),
    todayClaims: protectedProcedure
      .query(({ ctx }) => db.getTodayClaimedQuests(ctx.user.id)),
  }),

  // ── Endorsements ────────────────────────────────────────────────────────
  endorsements: router({
    give: protectedProcedure
      .input(z.object({ userId: z.number(), type: z.enum(["good-sport", "on-time", "accurate-rater", "great-partner", "skilled-player"]) }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot endorse yourself" });
        const alreadyEndorsed = await db.hasExistingEndorsement(ctx.user.id, input.userId, input.type);
        if (alreadyEndorsed) throw new TRPCError({ code: "BAD_REQUEST", message: "You've already given this endorsement" });
        const result = await db.giveEndorsement(ctx.user.id, input.userId, input.type);
        // Notify the endorsed user
        const endorser = await db.getUserById(ctx.user.id);
        const endorserName = endorser?.name || endorser?.nickname || "Someone";
        const typeLabel = input.type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        db.createNotification(input.userId, {
          type: "system",
          title: `${endorserName} endorsed you as "${typeLabel}"! 🌟`,
          link: "profile",
        }).catch(() => {});
        sendRealtimeNotification(input.userId, {
          type: "system",
          title: `New endorsement! 🌟`,
          body: `${endorserName} thinks you're a ${typeLabel}`,
        });
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    revoke: protectedProcedure
      .input(z.object({ userId: z.number(), type: z.enum(["good-sport", "on-time", "accurate-rater", "great-partner", "skilled-player"]) }))
      .mutation(({ ctx, input }) => db.revokeEndorsement(ctx.user.id, input.userId, input.type)),
    getForUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => db.getEndorsementsForUser(input.userId)),
    getMyEndorsements: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ ctx, input }) => db.getMyEndorsementsForUser(ctx.user.id, input.userId)),
  }),

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50), cursor: z.number().optional() }).optional())
      .query(({ ctx, input }) => db.getUserNotifications(ctx.user.id, input?.limit ?? 50)),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(({ ctx, input }) => db.markNotificationRead(ctx.user.id, input.notificationId)),
    markAllRead: protectedProcedure
      .mutation(({ ctx }) => db.markAllNotificationsRead(ctx.user.id)),
    deleteAll: protectedProcedure
      .mutation(({ ctx }) => db.deleteAllNotifications(ctx.user.id)),
    getPreferences: protectedProcedure
      .query(({ ctx }) => db.getNotificationPreferences(ctx.user.id)),
    updatePreferences: protectedProcedure
      .input(z.object({
        matchNotif: z.boolean().optional(),
        messageNotif: z.boolean().optional(),
        gameInviteNotif: z.boolean().optional(),
        achievementNotif: z.boolean().optional(),
        systemNotif: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        showDistance: z.boolean().optional(),
        showOnline: z.boolean().optional(),
        publicProfile: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) => db.updateNotificationPreferences(ctx.user.id, input)),
  }),

  // ── Reports & Blocks ───────────────────────────────────────────────────
  moderation: router({
    report: protectedProcedure
      .input(z.object({
        reportedId: z.number(),
        reportType: z.enum(["inappropriate", "fake-profile", "harassment", "safety", "other"]),
        description: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        const sanitized = { ...input };
        if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
        return db.createReport(ctx.user.id, sanitized);
      }),
    block: protectedProcedure
      .input(z.object({ blockedId: z.number(), reason: z.string().optional() }))
      .mutation(({ ctx, input }) => db.blockUser(ctx.user.id, input.blockedId, input.reason ? sanitizeString(input.reason) : undefined)),
    unblock: protectedProcedure
      .input(z.object({ blockedId: z.number() }))
      .mutation(({ ctx, input }) => db.unblockUser(ctx.user.id, input.blockedId)),
  }),

  // ── Challenges ────────────────────────────────────────────────────────────
  challenges: router({
    send: protectedProcedure
      .input(z.object({
        challengedId: z.number(),
        gameType: z.enum(["casual", "competitive", "tournament", "practice"]).optional(),
        format: z.enum(["singles", "mens-doubles", "womens-doubles", "mixed-doubles"]).optional(),
        message: z.string().max(200).optional(),
        courtId: z.number().optional(),
        locationName: z.string().max(255).optional(),
        scheduledAt: z.string().optional(),
        durationMinutes: z.number().min(30).max(480).optional(),
        skillLevelMin: z.string().optional(),
        skillLevelMax: z.string().optional(),
        maxPlayers: z.number().min(2).max(32).optional(),
        notes: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.challengedId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot challenge yourself" });
        // Non-match challenges require premium
        const isMatched = await db.areUsersMatched(ctx.user.id, input.challengedId);
        if (!isMatched) {
          const challenger = await db.getUserById(ctx.user.id);
          if (!challenger?.isPremium) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Upgrade to Premium to challenge players you haven't matched with" });
          }
        }
        const sanitized = { ...input };
        if (sanitized.message) sanitized.message = sanitizeString(sanitized.message);
        if (sanitized.notes) sanitized.notes = sanitizeString(sanitized.notes);
        if (sanitized.locationName) sanitized.locationName = sanitizeString(sanitized.locationName);
        const result = await db.createChallenge(ctx.user.id, input.challengedId, sanitized);
        // Notify the challenged user
        const challenger = await db.getUserById(ctx.user.id);
        const challengerName = challenger?.name || challenger?.nickname || "Someone";
        db.createNotification(input.challengedId, {
          type: "game_invite",
          title: `${challengerName} challenged you! ⚔️`,
          content: sanitized.message || "You've received a new challenge!",
          link: "challenges",
        }).catch(() => {});
        sendRealtimeNotification(input.challengedId, {
          type: "challenge",
          title: `${challengerName} challenged you! ⚔️`,
          body: sanitized.message || "You've received a new challenge!",
        });
        return result;
      }),
    respond: protectedProcedure
      .input(z.object({ challengeId: z.number(), accept: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        // Read the challenge first to get challengerId before responding
        const challengeInfo = await db.getChallengeById(input.challengeId);
        const result = await db.respondToChallenge(ctx.user.id, input.challengeId, input.accept);
        // Send real-time notification to the original challenger
        if (challengeInfo) {
          const responder = await db.getUserById(ctx.user.id);
          const responderName = responder?.nickname || responder?.name || "Someone";
          const title = input.accept
            ? `${responderName} accepted your challenge! 🏓`
            : `${responderName} declined your challenge`;
          sendRealtimeNotification(challengeInfo.challengerId, {
            type: "challenge",
            title,
            body: input.accept ? "Get ready to play!" : "",
          });
        }
        return result;
      }),
    pending: protectedProcedure
      .query(({ ctx }) => db.getPendingChallengesForUser(ctx.user.id)),
    sent: protectedProcedure
      .query(({ ctx }) => db.getSentChallenges(ctx.user.id)),
    allPending: protectedProcedure
      .query(({ ctx }) => db.getAllPendingForUser(ctx.user.id)),
  }),

  // ── Groups ───────────────────────────────────────────────────────────────
  groups: router({
    list: protectedProcedure
      .input(z.object({ city: z.string().optional(), type: z.enum(["social", "league", "tournament", "coaching"]).optional() }).optional())
      .query(({ input }) => db.getGroups(input?.city, input?.type)),
    myGroups: protectedProcedure
      .query(({ ctx }) => db.getUserGroups(ctx.user.id)),
    getById: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(({ input }) => db.getGroupById(input.groupId)),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        groupType: z.enum(["social", "league", "tournament", "coaching"]).default("social"),
        isPrivate: z.boolean().default(false),
        locationCity: z.string().optional(),
        photo: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sanitized = { ...input };
        sanitized.name = sanitizeString(sanitized.name);
        if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
        if (sanitized.locationCity) sanitized.locationCity = sanitizeString(sanitized.locationCity);
        const result = await db.createGroup(ctx.user.id, sanitized);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    join: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.joinGroup(ctx.user.id, input.groupId);
        // For private groups, notify admins after transaction completes
        if (result.status === "pending") {
          const admins = await db.getGroupAdmins(input.groupId);
          const requesterName = ctx.user.nickname || ctx.user.name || "Someone";
          const groupName = (result as any).groupName || "your group";
          for (const admin of admins) {
            db.createNotification(admin.userId, {
              type: "system",
              title: "New Group Join Request",
              content: `${requesterName} wants to join ${groupName}`,
              link: "groups",
            }).catch(() => {});
            sendRealtimeNotification(admin.userId, {
              type: "group_join_request",
              title: "New Group Join Request",
              body: `${requesterName} wants to join ${groupName}`,
              groupId: input.groupId,
            });
          }
        }
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    leave: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!await db.isGroupMember(ctx.user.id, input.groupId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You are not a member of this group" });
        }
        return db.leaveGroup(ctx.user.id, input.groupId);
      }),
    getMembers: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        // For private groups, only members can see the member list
        const group = await db.getGroupById(input.groupId);
        if (group?.isPrivate && !await db.isGroupMember(ctx.user.id, input.groupId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only group members can view members of a private group" });
        }
        return db.getGroupMembers(input.groupId);
      }),
    getLeaderboard: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(({ input }) => db.getGroupLeaderboard(input.groupId)),
    approveMember: protectedProcedure
      .input(z.object({ groupId: z.number(), userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.approveGroupMember(ctx.user.id, input.groupId, input.userId);
        // Send real-time notification so the user's UI updates immediately
        sendRealtimeNotification(input.userId, {
          type: "group_approved",
          title: "Group Request Approved!",
          body: "You've been accepted into the group",
          groupId: input.groupId,
        });
      }),
    declineMember: protectedProcedure
      .input(z.object({ groupId: z.number(), userId: z.number() }))
      .mutation(({ ctx, input }) => db.declineGroupMember(ctx.user.id, input.groupId, input.userId)),
    update: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        locationCity: z.string().optional(),
        photo: z.string().refine(url => /^(https?:\/\/|\/uploads\/|\/api\/files\/)/i.test(url), { message: "Photo URL must use HTTP/HTTPS or be a relative upload/file path" }).optional(),
      }))
      .mutation(({ ctx, input }) => {
        const { groupId, ...data } = input;
        const sanitized = { ...data };
        if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
        if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
        if (sanitized.locationCity) sanitized.locationCity = sanitizeString(sanitized.locationCity);
        return db.updateGroup(ctx.user.id, groupId, sanitized);
      }),
    updateMemberRole: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        targetUserId: z.number(),
        newRole: z.enum(["admin", "moderator", "member"]),
      }))
      .mutation(({ ctx, input }) => db.updateGroupMemberRole(ctx.user.id, input.groupId, input.targetUserId, input.newRole)),
    removeMember: protectedProcedure
      .input(z.object({ groupId: z.number(), targetUserId: z.number() }))
      .mutation(({ ctx, input }) => db.removeGroupMember(ctx.user.id, input.groupId, input.targetUserId)),
  }),

  // ── Coaching ────────────────────────────────────────────────────────────
  coaching: router({
    list: protectedProcedure
      .input(z.object({ status: z.enum(["open", "full", "completed", "cancelled"]).optional() }).optional())
      .query(({ input }) => db.getCoachingSessions(input?.status)),
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        coachName: z.string().optional(),
        location: z.string().optional(),
        courtId: z.number().optional(),
        locationLat: z.number().min(-90).max(90).optional(),
        locationLng: z.number().min(-180).max(180).optional(),
        locationName: z.string().max(255).optional(),
        isVirtual: z.boolean().optional(),
        scheduledAt: z.string(),
        durationMinutes: z.number().default(60),
        maxParticipants: z.number().default(10),
        costPerPerson: z.number().optional(),
        skillLevel: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        const sanitized = { ...input };
        sanitized.title = sanitizeString(sanitized.title);
        if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
        if (sanitized.coachName) sanitized.coachName = sanitizeString(sanitized.coachName);
        if (sanitized.location) sanitized.location = sanitizeString(sanitized.location);
        if (sanitized.locationName) sanitized.locationName = sanitizeString(sanitized.locationName);
        return db.createCoachingSession(ctx.user.id, sanitized);
      }),
    join: protectedProcedure
      .input(z.object({ coachingId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.joinCoachingSession(ctx.user.id, input.coachingId);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    approveParticipant: protectedProcedure
      .input(z.object({ coachingId: z.number(), userId: z.number() }))
      .mutation(({ ctx, input }) => db.approveCoachingParticipant(ctx.user.id, input.coachingId, input.userId)),
    declineParticipant: protectedProcedure
      .input(z.object({ coachingId: z.number(), userId: z.number() }))
      .mutation(({ ctx, input }) => db.declineCoachingParticipant(ctx.user.id, input.coachingId, input.userId)),
    leave: protectedProcedure
      .input(z.object({ coachingId: z.number() }))
      .mutation(({ ctx, input }) => db.leaveCoachingSession(ctx.user.id, input.coachingId)),
    getParticipants: protectedProcedure
      .input(z.object({ coachingId: z.number() }))
      .query(({ input }) => db.getCoachingParticipants(input.coachingId)),
    addReview: protectedProcedure
      .input(z.object({ coachingId: z.number(), rating: z.number().min(1).max(5), comment: z.string().optional() }))
      .mutation(({ ctx, input }) => {
        const sanitized = { rating: input.rating, comment: input.comment ? sanitizeString(input.comment) : undefined };
        return db.addCoachingReview(ctx.user.id, input.coachingId, sanitized);
      }),
    getReviews: protectedProcedure
      .input(z.object({ coachingId: z.number() }))
      .query(({ input }) => db.getCoachingReviews(input.coachingId)),
    markAttendance: protectedProcedure
      .input(z.object({ coachingId: z.number(), userId: z.number(), attended: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return db.markCoachingAttendance(ctx.user.id, input.coachingId, input.userId, input.attended);
      }),
    update: protectedProcedure
      .input(z.object({
        coachingId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(5000).optional(),
        coachName: z.string().max(100).optional(),
        location: z.string().max(255).optional(),
        courtId: z.number().nullable().optional(),
        locationLat: z.number().min(-90).max(90).nullable().optional(),
        locationLng: z.number().min(-180).max(180).nullable().optional(),
        locationName: z.string().max(255).nullable().optional(),
        scheduledAt: z.string().optional(),
        durationMinutes: z.number().min(15).max(480).optional(),
        maxParticipants: z.number().min(1).max(100).optional(),
        costPerPerson: z.number().min(0).max(10000).optional(),
        skillLevel: z.string().optional(),
        agenda: z.string().max(5000).optional(),
        focusAreas: z.string().max(2000).optional(),
        drillPlan: z.string().optional(),
        sessionNotes: z.string().optional(),
        equipmentNeeded: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { coachingId, ...data } = input;
        const sanitized = { ...data };
        if (sanitized.title) sanitized.title = sanitizeString(sanitized.title);
        if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
        if (sanitized.coachName) sanitized.coachName = sanitizeString(sanitized.coachName);
        if (sanitized.location) sanitized.location = sanitizeString(sanitized.location);
        if (sanitized.locationName) sanitized.locationName = sanitizeString(sanitized.locationName);
        if (sanitized.agenda) sanitized.agenda = sanitizeString(sanitized.agenda);
        if (sanitized.focusAreas) sanitized.focusAreas = sanitizeString(sanitized.focusAreas);
        if (sanitized.drillPlan) sanitized.drillPlan = sanitizeString(sanitized.drillPlan);
        if (sanitized.sessionNotes) sanitized.sessionNotes = sanitizeString(sanitized.sessionNotes);
        if (sanitized.equipmentNeeded) sanitized.equipmentNeeded = sanitizeString(sanitized.equipmentNeeded);
        try {
          return await db.updateCoachingSession(ctx.user.id, coachingId, sanitized);
        } catch (e: any) {
          throw new TRPCError({ code: e.code === "FORBIDDEN" ? "FORBIDDEN" : e.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message: e.message });
        }
      }),
    cancel: protectedProcedure
      .input(z.object({ coachingId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.cancelCoachingSession(ctx.user.id, input.coachingId);
        } catch (e: any) {
          throw new TRPCError({ code: e.code === "FORBIDDEN" ? "FORBIDDEN" : e.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message: e.message });
        }
      }),
    complete: protectedProcedure
      .input(z.object({ coachingId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.completeCoachingSession(ctx.user.id, input.coachingId);
        } catch (e: any) {
          throw new TRPCError({ code: e.code === "FORBIDDEN" ? "FORBIDDEN" : e.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message: e.message });
        }
      }),
    getMySessions: protectedProcedure
      .query(({ ctx }) => db.getMyCoachingSessions(ctx.user.id)),
    getAnnouncements: protectedProcedure
      .input(z.object({ coachingId: z.number() }))
      .query(({ input }) => db.getCoachingAnnouncements(input.coachingId)),
    postAnnouncement: protectedProcedure
      .input(z.object({ coachingId: z.number(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.createCoachingAnnouncement(ctx.user.id, input.coachingId, sanitizeString(input.content));
        } catch (e: any) {
          throw new TRPCError({ code: "FORBIDDEN", message: e.message });
        }
      }),
  }),

  // ── Admin ───────────────────────────────────────────────────────────────
  admin: router({
    getStats: adminProcedure
      .query(() => db.getAdminStats()),
    getReports: adminProcedure
      .input(z.object({ status: z.enum(["pending", "reviewed", "action-taken", "dismissed"]).optional(), page: z.number().default(1), limit: z.number().default(50) }).optional())
      .query(({ input }) => db.getAdminReports(input?.status, input?.page, input?.limit)),
    resolveReport: adminProcedure
      .input(z.object({ reportId: z.number(), status: z.enum(["reviewed", "action-taken", "dismissed"]) }))
      .mutation(({ ctx, input }) => db.resolveReport(ctx.user.id, input.reportId, input.status)),
    getUsers: adminProcedure
      .input(z.object({ search: z.string().optional(), page: z.number().default(1), limit: z.number().default(20) }).optional())
      .query(async ({ input }) => {
        const users = await db.getAdminUsers(input?.search, input?.page, input?.limit);
        return users.map(u => db.sanitizeUser(u));
      }),
    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "superadmin"]) }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot modify your own role" });
        if (input.role === "superadmin" || input.role === "admin") {
          const admin = await db.getUserById(ctx.user.id);
          if (admin?.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Only superadmins can assign admin/superadmin roles" });
        }
        return db.updateUserRole(input.userId, input.role);
      }),
    suspendUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot suspend yourself" });
        const target = await db.getUserById(input.userId);
        if (target?.role === "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Cannot suspend a superadmin" });
        return db.suspendUser(input.userId);
      }),
    unsuspendUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        return db.unsuspendUser(input.userId);
      }),
    getAppSettings: adminProcedure
      .query(() => db.getAppSettings()),
    updateAppSetting: adminProcedure
      .input(z.object({ key: z.string().min(1).max(100), value: z.string().max(10000) }))
      .mutation(({ ctx, input }) => db.updateAppSetting(ctx.user.id, sanitizeString(input.key), sanitizeString(input.value))),
  }),

  // ── User Photos ─────────────────────────────────────────────────────────
  photos: router({
    list: protectedProcedure
      .input(z.object({ userId: z.number().optional() }).optional())
      .query(({ ctx, input }) => db.getUserPhotos(input?.userId ?? ctx.user.id)),
    add: protectedProcedure
      .input(z.object({ photoUrl: z.string().url().max(2048) }))
      .mutation(({ ctx, input }) => db.addUserPhoto(ctx.user.id, input.photoUrl)),
    remove: protectedProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(({ ctx, input }) => db.removeUserPhoto(ctx.user.id, input.photoId)),
    setPrimary: protectedProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(({ ctx, input }) => db.setPrimaryPhoto(ctx.user.id, input.photoId)),
    reorder: protectedProcedure
      .input(z.object({ photoIds: z.array(z.number()) }))
      .mutation(({ ctx, input }) => db.reorderUserPhotos(ctx.user.id, input.photoIds)),
  }),

  // ── File Upload ─────────────────────────────────────────────────────────
  upload: router({
    getPresignedUrl: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"]),
        purpose: z.enum(["profile-photo", "chat-image", "court-photo", "chat-video"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate file extension matches MIME type
        const ext = input.fileName.split('.').pop()?.toLowerCase();
        const allowedExts: Record<string, string[]> = {
          "image/jpeg": ["jpg", "jpeg"],
          "image/png": ["png"],
          "image/webp": ["webp"],
          "image/gif": ["gif"],
          "video/mp4": ["mp4"],
          "video/quicktime": ["mov"],
          "video/webm": ["webm"],
        };
        if (!allowedExts[input.fileType]?.includes(ext || "")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "File extension does not match file type" });
        }
        const key = `${input.purpose}/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        return { key, uploadUrl: `/api/upload/${key}` };
      }),
    getDownloadUrl: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ ctx, input }) => {
        // Validate the key belongs to the requesting user or is a shared resource (court photos)
        const userPrefix = `/${ctx.user.id}/`;
        const isOwnFile = input.key.includes(userPrefix);
        const isCourtPhoto = input.key.startsWith("court-photo/");
        const isChatVideo = input.key.startsWith("chat-video/");
        if (!isOwnFile && !isCourtPhoto && !isChatVideo) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this file" });
        }
        const url = await getSignedUrl(input.key);
        return { url };
      }),
  }),

  // ── Premium / Stripe ────────────────────────────────────────────────────
  premium: router({
    getStatus: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        return {
          isPremium: user?.isPremium ?? false,
          premiumUntil: user?.premiumUntil ?? null,
        };
      }),
    createCheckoutSession: protectedProcedure
      .input(z.object({ plan: z.enum(["monthly", "annual"]) }))
      .mutation(async ({ ctx, input }) => {
        // Stripe integration - requires STRIPE_SECRET_KEY env var
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Payment processing not configured. Set STRIPE_SECRET_KEY." });
        }
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(stripeKey);
        const priceId = input.plan === "monthly"
          ? process.env.STRIPE_MONTHLY_PRICE_ID
          : process.env.STRIPE_ANNUAL_PRICE_ID;
        if (!priceId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe price IDs not configured." });
        }
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [{ price: priceId, quantity: 1 }],
          customer_email: ctx.user.email ?? undefined,
          metadata: { userId: String(ctx.user.id) },
          subscription_data: { metadata: { userId: String(ctx.user.id) } },
          success_url: `${ctx.req.headers.origin || "http://localhost:3000"}/?premium=success`,
          cancel_url: `${ctx.req.headers.origin || "http://localhost:3000"}/?premium=cancelled`,
        });
        return { sessionId: session.id, url: session.url };
      }),
    cancelSubscription: protectedProcedure
      .mutation(async ({ ctx }) => {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Payment processing not configured." });
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(stripeKey);
        // Find customer by email and cancel active subscriptions
        if (ctx.user.email) {
          const customers = await stripe.customers.list({ email: ctx.user.email, limit: 1 });
          if (customers.data.length > 0) {
            const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 10 });
            for (const sub of subs.data) {
              await stripe.subscriptions.cancel(sub.id);
            }
          }
        }
        await db.updateUserProfile(ctx.user.id, { isPremium: false, premiumUntil: null });
        return { success: true };
      }),
  }),

  // ── Email ───────────────────────────────────────────────────────────────
  email: router({
    sendVerification: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No email address on account" });
      }
      const emailConfig = {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM || "noreply@pklcourtconnect.com",
      };
      if (!emailConfig.host || !emailConfig.user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars." });
      }
      const transporter = await getEmailTransporter({ host: emailConfig.host, port: emailConfig.port, user: emailConfig.user, pass: emailConfig.pass ?? "" });
      const { randomInt } = await import("crypto");
      const verificationCode = String(randomInt(100000, 999999));
      await db.createEmailVerificationCode(ctx.user.id, verificationCode);
      await transporter.sendMail({
        from: emailConfig.from,
        to: ctx.user.email,
        subject: "PKL Court Connect - Email Verification",
        html: `<h2>Verify Your Email</h2><p>Your verification code is: <strong>${verificationCode}</strong></p><p>This code expires in 15 minutes.</p>`,
      });
      return { success: true };
    }),
    verifyCode: protectedProcedure
      .input(z.object({ code: z.string().length(6) }))
      .mutation(async ({ ctx, input }) => {
        const valid = await db.verifyEmailCode(ctx.user.id, input.code);
        if (!valid) {
          return { success: false, error: "Invalid or expired verification code. Please request a new one." };
        }
        await db.updateUserProfile(ctx.user.id, { isVerified: true } as any);
        return { success: true };
      }),
  }),

  // ── Account Management ──────────────────────────────────────────────────
  account: router({
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        // OAuth users may not have an email/password set
        if (!ctx.user.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Password change is not available for social login accounts" });
        }
        // Verify current password
        const user = await db.authenticateUser(ctx.user.email, input.currentPassword);
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
        // Hash new password
        const { randomBytes, scryptSync } = await import("crypto");
        const salt = randomBytes(16).toString("hex");
        const derivedKey = scryptSync(input.newPassword, salt, 64).toString("hex");
        await db.changePassword(ctx.user.id, `${salt}:${derivedKey}`);
        return { success: true };
      }),
    deleteAccount: protectedProcedure
      .input(z.object({ password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        // Require password confirmation before creating deletion token
        if (!ctx.user.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete social login account this way" });
        }
        const verified = await db.authenticateUser(ctx.user.email, input.password);
        if (!verified) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect password" });
        }
        const { randomBytes } = await import("crypto");
        const token = randomBytes(32).toString("hex");
        await db.createAccountDeletionToken(ctx.user.id, token);
        // Token is NOT returned to client — stored server-side only
        // Immediately proceed with deletion since password was verified
        const userId = await db.verifyAccountDeletionToken(token);
        if (!userId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Deletion failed" });
        }
        await db.softDeleteUser(userId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true, message: "Account has been deleted." };
      }),
    confirmDeleteAccount: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = await db.verifyAccountDeletionToken(input.token);
        if (!userId || userId !== ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired deletion token" });
        }
        await db.softDeleteUser(userId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true };
      }),
    exportData: protectedProcedure
      .mutation(async ({ ctx }) => {
        const data = await db.exportUserData(ctx.user.id);
        return data;
      }),
    getBlockedUsers: protectedProcedure
      .query(({ ctx }) => db.getBlockedUsers(ctx.user.id)),
    unblockUser: protectedProcedure
      .input(z.object({ blockedId: z.number() }))
      .mutation(({ ctx, input }) => db.unblockUser(ctx.user.id, input.blockedId)),
  }),

  // ── Push Notifications ──────────────────────────────────────────────────
  push: router({
    subscribe: protectedProcedure
      .input(z.object({
        subscription: z.union([
          z.object({
            type: z.literal("web-push"),
            endpoint: z.string().url(),
            keys: z.object({
              p256dh: z.string(),
              auth: z.string(),
            }),
          }),
          z.object({
            type: z.literal("fcm"),
            token: z.string().min(1),
          }),
        ]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.savePushSubscription(ctx.user.id, input.subscription);
        return { success: true };
      }),
    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        await db.removePushSubscription(ctx.user.id, input.endpoint);
        return { success: true };
      }),
    getVapidKey: publicProcedure.query(() => {
      return { key: process.env.VAPID_PUBLIC_KEY || "" };
    }),
  }),

  // ── Search ──────────────────────────────────────────────────────────────
  search: router({
    global: protectedProcedure
      .input(z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).default(20),
      }))
      .query(({ ctx, input }) => db.globalSearch(input.query, ctx.user.id, input.limit)),
  }),

  // ── Leaderboard ─────────────────────────────────────────────────────────
  leaderboard: router({
    get: publicProcedure
      .input(z.object({
        type: z.enum(["xp", "streak", "games", "wins"]).default("xp"),
        limit: z.number().min(1).max(100).default(50),
        period: z.enum(["all", "weekly"]).default("all"),
      }).optional())
      .query(({ input }) => db.getLeaderboard(input?.type || "xp", input?.limit || 50, input?.period || "all")),
  }),

  // ── Tournaments ─────────────────────────────────────────────────────────
  tournaments: router({
    list: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(({ input }) => db.getTournaments(input ? { status: input.status } : undefined)),
    myTournaments: protectedProcedure
      .query(({ ctx }) => db.getMyTournaments(ctx.user.id)),
    getById: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ ctx, input }) => db.getTournamentById(input.tournamentId, ctx.user.id)),
    getBracket: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ ctx, input }) => db.getTournamentBracket(input.tournamentId, ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(3).max(100),
        description: z.string().max(2000).optional(),
        format: z.enum(["single-elimination", "double-elimination", "round-robin"]),
        gameFormat: z.enum(["singles", "mens-doubles", "womens-doubles", "mixed-doubles"]),
        maxParticipants: z.number().min(2).max(128).default(16),
        entryFee: z.number().min(0).optional(),
        prizeDescription: z.string().max(500).optional(),
        pointsToWin: z.number().min(1).max(21).default(11),
        bestOf: z.number().min(1).max(7).default(3),
        winBy: z.number().min(1).max(5).default(2),
        courtId: z.number().optional(),
        locationLat: z.number().optional(),
        locationLng: z.number().optional(),
        locationName: z.string().max(255).optional(),
        skillLevelMin: z.string().optional(),
        skillLevelMax: z.string().optional(),
        registrationDeadline: z.string().optional(),
        startDate: z.string(),
        endDate: z.string().optional(),
        rules: z.string().max(5000).optional(),
        isPublic: z.boolean().default(true),
        requiresApproval: z.boolean().default(false),
        groupId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const startDate = new Date(input.startDate);
        if (isNaN(startDate.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid start date" });
        if (startDate < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Start date must be in the future" });
        if (input.registrationDeadline) {
          const regDate = new Date(input.registrationDeadline);
          if (isNaN(regDate.getTime()) || regDate > startDate) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Registration deadline must be before start date" });
          }
        }
        const sanitized = { ...input };
        if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
        if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
        if (sanitized.locationName) sanitized.locationName = sanitizeString(sanitized.locationName);
        if (sanitized.rules) sanitized.rules = sanitizeString(sanitized.rules);
        if (sanitized.prizeDescription) sanitized.prizeDescription = sanitizeString(sanitized.prizeDescription);
        const result = await db.createTournament(ctx.user.id, sanitized);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    join: protectedProcedure
      .input(z.object({
        tournamentId: z.number(),
        partnerId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.joinTournament(ctx.user.id, input.tournamentId, input.partnerId);
        db.checkAndAwardAchievements(ctx.user.id).catch(() => {});
        return result;
      }),
    leave: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .mutation(({ ctx, input }) => db.leaveTournament(ctx.user.id, input.tournamentId)),
    update: protectedProcedure
      .input(z.object({
        tournamentId: z.number(),
        name: z.string().min(3).max(100).optional(),
        description: z.string().max(2000).optional(),
        rules: z.string().max(5000).optional(),
        maxParticipants: z.number().min(2).max(128).optional(),
        registrationDeadline: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.enum(["draft", "registration", "seeding", "in-progress", "completed", "cancelled"]).optional(),
        isPublic: z.boolean().optional(),
        prizeDescription: z.string().max(500).optional(),
      }))
      .mutation(({ ctx, input }) => {
        const sanitized = { ...input };
        if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
        if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
        if (sanitized.rules) sanitized.rules = sanitizeString(sanitized.rules);
        if (sanitized.prizeDescription) sanitized.prizeDescription = sanitizeString(sanitized.prizeDescription);
        return db.updateTournament(ctx.user.id, sanitized.tournamentId, sanitized);
      }),
    seedBracket: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .mutation(({ ctx, input }) => {
        const isAdmin = ctx.user.role === "admin" || ctx.user.role === "superadmin";
        return db.seedTournamentBracket(ctx.user.id, input.tournamentId, isAdmin);
      }),
    startMatch: protectedProcedure
      .input(z.object({ tournamentId: z.number(), matchId: z.number() }))
      .mutation(({ ctx, input }) => db.startTournamentMatch(ctx.user.id, input.tournamentId, input.matchId)),
    reportResult: protectedProcedure
      .input(z.object({
        tournamentId: z.number(),
        matchId: z.number(),
        winnerId: z.number(),
      }))
      .mutation(({ ctx, input }) => db.reportTournamentMatchResult(ctx.user.id, input.tournamentId, input.matchId, input.winnerId)),
    approveParticipant: protectedProcedure
      .input(z.object({ tournamentId: z.number(), participantId: z.number() }))
      .mutation(({ ctx, input }) => db.approveTournamentParticipant(ctx.user.id, input.tournamentId, input.participantId)),
    removeParticipant: protectedProcedure
      .input(z.object({ tournamentId: z.number(), participantId: z.number() }))
      .mutation(({ ctx, input }) => db.removeTournamentParticipant(ctx.user.id, input.tournamentId, input.participantId)),
    updateSeed: protectedProcedure
      .input(z.object({ tournamentId: z.number(), participantId: z.number(), seed: z.number() }))
      .mutation(({ ctx, input }) => db.updateParticipantSeed(ctx.user.id, input.tournamentId, input.participantId, input.seed)),
    cancel: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .mutation(({ ctx, input }) => db.cancelTournament(ctx.user.id, input.tournamentId)),
  }),

  // ── Invites ─────────────────────────────────────────────────────────────
  invites: router({
    /** Get users the caller can invite — matches always, nearby only for premium */
    getInviteable: protectedProcedure
      .input(z.object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        radiusMiles: z.number().min(1).max(500).default(25),
      }))
      .query(async ({ ctx, input }) => {
        const matchedUsers = await db.getUserMatchesEnriched(ctx.user.id);
        const matchList = matchedUsers.map((m: any) => ({
          id: m.user.id,
          name: m.user.name,
          nickname: m.user.nickname,
          profilePhotoUrl: m.user.profilePhotoUrl,
          hasProfilePhoto: m.user.hasProfilePhoto,
          skillLevel: m.user.skillLevel,
          source: "match" as const,
        }));

        let nearbyList: any[] = [];
        if (ctx.user.isPremium && input.lat != null && input.lng != null) {
          const me = await db.getUserById(ctx.user.id);
          const lat = me?.travelModeLat ?? input.lat;
          const lng = me?.travelModeLng ?? input.lng;
          const nearbyUsers = await db.getNearbyUsersWithDistance(ctx.user.id, lat, lng, input.radiusMiles);
          const matchedIds = new Set(matchList.map((m: any) => m.id));
          nearbyList = nearbyUsers
            .filter((u: any) => !matchedIds.has(u.id))
            .map((u: any) => ({
              id: u.id,
              name: u.name,
              nickname: u.nickname,
              profilePhotoUrl: u.profilePhotoUrl,
              hasProfilePhoto: u.hasProfilePhoto,
              skillLevel: u.skillLevel,
              distance: u.distance,
              source: "nearby" as const,
            }));
        }

        return { matches: matchList, nearby: nearbyList, isPremium: !!ctx.user.isPremium };
      }),

    /** Send invites to users for a game, tournament, group, or coaching session */
    send: protectedProcedure
      .input(z.object({
        targetType: z.enum(["game", "tournament", "group", "coaching"]),
        targetId: z.number(),
        userIds: z.array(z.number()).min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        const sender = await db.getUserById(ctx.user.id);
        if (!sender) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        const senderName = sender.nickname || sender.name || "Someone";

        // Get caller's matched user IDs for verification
        const matchRows = await db.getUserMatches(ctx.user.id);
        const matchedIds = new Set(matchRows.map(m => m.user1Id === ctx.user.id ? m.user2Id : m.user1Id));

        // Verify ownership / membership for each target type
        let targetName = "";
        if (input.targetType === "game") {
          const game = await db.getGameById(input.targetId);
          if (!game) throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" });
          if (game.organizerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the organizer can send invites" });
          targetName = game.locationName || "a game";
        } else if (input.targetType === "tournament") {
          const t = await db.getTournamentById(input.targetId, ctx.user.id);
          if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
          if (t.organizerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the organizer can send invites" });
          targetName = t.name || "a tournament";
        } else if (input.targetType === "group") {
          const members = await db.getGroupMembers(input.targetId);
          const myMembership = members.find((m: any) => m.userId === ctx.user.id);
          if (!myMembership || !["admin", "moderator"].includes(myMembership.role)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only admins/moderators can send group invites" });
          }
          const group = await db.getGroupById(input.targetId);
          targetName = group?.name || "a group";
        } else if (input.targetType === "coaching") {
          const participants = await db.getCoachingParticipants(input.targetId);
          // The organizer is the one who created it — check via participants or session data
          const sessions = await db.getCoachingSessions();
          const session = sessions.find((s: any) => s.id === input.targetId);
          if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Coaching session not found" });
          if (session.organizerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the organizer can send invites" });
          targetName = session.title || "a coaching session";
        }

        // Validate each invitee: must be a match (or nearby if premium)
        for (const userId of input.userIds) {
          if (userId === ctx.user.id) continue; // skip self
          if (!matchedIds.has(userId) && !sender.isPremium) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Free users can only invite matched players. Upgrade to Premium to invite nearby players!" });
          }
          // Check if blocked
          const blocked = await db.isBlocked(ctx.user.id, userId);
          if (blocked) continue; // silently skip blocked users
        }

        const typeLabels: Record<string, string> = {
          game: "Game",
          tournament: "Tournament",
          group: "Group",
          coaching: "Coaching Session",
        };
        const linkMap: Record<string, string> = {
          game: "gameHistory",
          tournament: "tournaments",
          group: "groups",
          coaching: "coaching",
        };

        let sentCount = 0;
        for (const userId of input.userIds) {
          if (userId === ctx.user.id) continue;
          const blocked = await db.isBlocked(ctx.user.id, userId);
          if (blocked) continue;

          db.createNotification(userId, {
            type: input.targetType === "tournament" ? "tournament_invite" : "game_invite",
            title: `${senderName} invited you to ${targetName}`,
            content: `You've been invited to join a ${typeLabels[input.targetType]}!`,
            link: linkMap[input.targetType],
            targetId: input.targetId,
          }).catch(() => {});

          sendRealtimeNotification(userId, {
            type: "invite",
            title: `${senderName} invited you! 🏓`,
            body: `Join ${targetName} — ${typeLabels[input.targetType]}`,
            targetType: input.targetType,
            targetId: input.targetId,
          });
          sentCount++;
        }

        return { sent: sentCount };
      }),
  }),

  // ── Activity Feed ───────────────────────────────────────────────────────
  feed: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(({ ctx, input }) => db.getActivityFeed(ctx.user.id, input?.limit ?? 50)),
    my: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(({ ctx, input }) => db.getMyActivityFeed(ctx.user.id, input?.limit ?? 50)),
    // Social feed posts
    posts: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(30),
        offset: z.number().min(0).default(0),
        filter: z.string().optional(),
      }).optional())
      .query(({ ctx, input }) => db.getFeedPosts(ctx.user.id, {
        limit: input?.limit ?? 30,
        offset: input?.offset ?? 0,
        filter: input?.filter,
      })),
    createPost: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(2000),
        photoUrl: z.string().optional(),
        postType: z.enum(["general", "highlight", "question", "tip", "looking_for_players"]).optional(),
      }))
      .mutation(({ ctx, input }) => db.createFeedPost(ctx.user.id, input)),
    toggleLike: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(({ ctx, input }) => db.toggleFeedLike(ctx.user.id, input.postId)),
    addComment: protectedProcedure
      .input(z.object({ postId: z.number(), content: z.string().min(1).max(1000) }))
      .mutation(({ ctx, input }) => db.addFeedComment(ctx.user.id, input.postId, input.content)),
    getComments: protectedProcedure
      .input(z.object({ postId: z.number(), limit: z.number().min(1).max(100).default(50) }))
      .query(({ input }) => db.getFeedComments(input.postId, input.limit)),
    deletePost: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(({ ctx, input }) => db.deleteFeedPost(ctx.user.id, input.postId)),
  }),

  // ── Favorite Players ───────────────────────────────────────────────────
  favorites: router({
    list: protectedProcedure
      .query(({ ctx }) => db.getFavoritePlayers(ctx.user.id)),
    add: protectedProcedure
      .input(z.object({ favoriteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.favoriteId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot favorite yourself" });
        return db.addFavoritePlayer(ctx.user.id, input.favoriteId);
      }),
    remove: protectedProcedure
      .input(z.object({ favoriteId: z.number() }))
      .mutation(({ ctx, input }) => db.removeFavoritePlayer(ctx.user.id, input.favoriteId)),
    check: protectedProcedure
      .input(z.object({ favoriteId: z.number() }))
      .query(({ ctx, input }) => db.isFavoritePlayer(ctx.user.id, input.favoriteId)),
  }),

  // ── Rivalries ──────────────────────────────────────────────────────────
  rivalries: router({
    list: protectedProcedure
      .query(({ ctx }) => db.getUserRivalries(ctx.user.id)),
  }),

  // ── Referrals ──────────────────────────────────────────────────────────
  referrals: router({
    create: protectedProcedure
      .mutation(({ ctx }) => db.createReferralCode(ctx.user.id)),
    redeem: protectedProcedure
      .input(z.object({ code: z.string().min(1).max(20) }))
      .mutation(({ ctx, input }) => db.redeemReferralCode(ctx.user.id, input.code)),
    list: protectedProcedure
      .query(({ ctx }) => db.getUserReferrals(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
