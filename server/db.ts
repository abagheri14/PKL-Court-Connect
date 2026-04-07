import { eq, and, ne, sql, desc, asc, like, or, isNull, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, matches, swipes, conversations, conversationParticipants,
  messages, courts, courtReviews, games, gameParticipants, gameFeedback,
  endorsements, achievements, userAchievements, notifications, blocks, reports,
  appSettings, groups, groupMembers, sharedCoaching, coachingParticipants, questClaims,
  coachingReviews, coachingAnnouncements, userPhotos, pushSubscriptions, passwordResetTokens, accountDeletionTokens,
  gameResults, notificationPreferences, challenges, gameRounds, courtSubmissions,
  tournaments, tournamentParticipants, tournamentMatches, emailVerificationCodes,
  courtBookings, activityFeed, messageReactions, courtPhotos, rivalries, favoritePlayers, referrals,
  feedPosts, feedComments, feedLikes, feedReactions, feedBookmarks,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Get the database connection. Always returns a valid connection or throws.
 * All `if (!db)` checks after calling this are dead code since this never returns null.
 */
export async function getDb(): Promise<ReturnType<typeof drizzle>> {
  if (!_db) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("[Database] DATABASE_URL environment variable is required. Server cannot start without a database connection.");
    }
    try {
      _db = drizzle(dbUrl);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      throw error;
    }
  }
  return _db!;
}

// =============================================================================
// RUNTIME SCHEMA MIGRATION (ensures columns/tables exist even if db:push fails)
// =============================================================================

export async function ensureSchema(): Promise<void> {
  const db = await getDb();

  // Helper: run ALTER TABLE ADD COLUMN, ignore "Duplicate column" error (1060)
  async function addColumnIfMissing(table: string, colDef: string) {
    try {
      await db.execute(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN ${colDef}`));
    } catch (e: any) {
      if (e?.errno === 1060 || e?.code === 'ER_DUP_FIELDNAME') return; // already exists
      console.error(`[Schema] Failed to add column to ${table}: ${colDef}`, e?.message);
    }
  }

  // Helper: run CREATE TABLE IF NOT EXISTS
  async function createTableIfMissing(ddl: string) {
    try {
      await db.execute(sql.raw(ddl));
    } catch (e: any) {
      console.error(`[Schema] CREATE TABLE failed:`, e?.message);
    }
  }

  console.log("[Schema] Ensuring all columns and tables exist...");

  // --- Users table columns that may be missing ---
  await addColumnIfMissing("users", "`handedness` enum('left','right','ambidextrous') DEFAULT 'right'");
  await addColumnIfMissing("users", "`pace` enum('fast','rally','both') DEFAULT 'both'");
  await addColumnIfMissing("users", "`courtPreference` enum('indoor','outdoor','both') DEFAULT 'both'");
  await addColumnIfMissing("users", "`goals` text DEFAULT NULL");

  // --- Swipes ---
  await addColumnIfMissing("swipes", "`isSuperRally` boolean NOT NULL DEFAULT false");

  // --- Games ---
  await addColumnIfMissing("games", "`groupId` int DEFAULT NULL");

  // --- Shared coaching ---
  await addColumnIfMissing("shared_coaching", "`courtId` int DEFAULT NULL");
  await addColumnIfMissing("shared_coaching", "`locationLat` float DEFAULT NULL");
  await addColumnIfMissing("shared_coaching", "`locationLng` float DEFAULT NULL");
  await addColumnIfMissing("shared_coaching", "`locationName` varchar(255) DEFAULT NULL");

  // --- Game results ---
  await addColumnIfMissing("game_results", "`scoreConfirmedBy` text DEFAULT NULL");
  await addColumnIfMissing("game_results", "`scoreDisputed` boolean DEFAULT false");

  // --- Feed reactions and bookmarks tables ---
  await createTableIfMissing(`
    CREATE TABLE IF NOT EXISTS \`feed_reactions\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`postId\` int NOT NULL,
      \`userId\` int NOT NULL,
      \`emoji\` varchar(16) NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uniq_feed_reaction\` (\`postId\`, \`userId\`, \`emoji\`)
    )
  `);

  await createTableIfMissing(`
    CREATE TABLE IF NOT EXISTS \`feed_bookmarks\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`postId\` int NOT NULL,
      \`userId\` int NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uniq_feed_bookmark\` (\`postId\`, \`userId\`)
    )
  `);

  // --- Other tables that may be missing ---
  await createTableIfMissing(`
    CREATE TABLE IF NOT EXISTS \`push_subscriptions\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`endpoint\` text NOT NULL,
      \`p256dh\` text NOT NULL,
      \`auth\` text NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await createTableIfMissing(`
    CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`token\` varchar(255) NOT NULL,
      \`expiresAt\` timestamp NOT NULL,
      \`usedAt\` timestamp NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await createTableIfMissing(`
    CREATE TABLE IF NOT EXISTS \`account_deletion_tokens\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL,
      \`token\` varchar(255) NOT NULL,
      \`expiresAt\` timestamp NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await createTableIfMissing(`
    CREATE TABLE IF NOT EXISTS \`game_results\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`gameId\` int NOT NULL UNIQUE,
      \`winnerTeam\` enum('team1','team2','draw') DEFAULT NULL,
      \`team1Score\` int DEFAULT 0,
      \`team2Score\` int DEFAULT 0,
      \`team1PlayerIds\` text DEFAULT NULL,
      \`team2PlayerIds\` text DEFAULT NULL,
      \`recordedBy\` int DEFAULT NULL,
      \`recordedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`scoreConfirmedBy\` text DEFAULT NULL,
      \`scoreDisputed\` boolean DEFAULT false
    )
  `);

  await createTableIfMissing(`
    CREATE TABLE IF NOT EXISTS \`notification_preferences\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`userId\` int NOT NULL UNIQUE,
      \`matchNotif\` boolean NOT NULL DEFAULT true,
      \`messageNotif\` boolean NOT NULL DEFAULT true,
      \`gameInviteNotif\` boolean NOT NULL DEFAULT true,
      \`achievementNotif\` boolean NOT NULL DEFAULT true,
      \`systemNotif\` boolean NOT NULL DEFAULT true,
      \`pushEnabled\` boolean NOT NULL DEFAULT true,
      \`emailEnabled\` boolean NOT NULL DEFAULT true,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  console.log("[Schema] Schema check complete.");
}

// =============================================================================
// USER QUERIES
// =============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getNearbyUsers(userId: number, lat: number, lng: number, radiusMiles: number) {
  const db = await getDb();
  // Haversine approximation - 1 degree ≈ 69 miles
  const degreeRadius = radiusMiles / 69;
  return db.select().from(users).where(
    and(
      ne(users.id, userId),
      eq(users.isDeleted, false),
      eq(users.isActive, true),
      sql`${users.latitude} BETWEEN ${lat - degreeRadius} AND ${lat + degreeRadius}`,
      sql`${users.longitude} BETWEEN ${lng - degreeRadius} AND ${lng + degreeRadius}`,
    )
  );
}

export async function updateUserLocation(userId: number, lat: number, lng: number, city?: string) {
  const db = await getDb();
  await db.update(users).set({ latitude: lat, longitude: lng, city: city ?? null, locationUpdatedAt: new Date() }).where(eq(users.id, userId));
}

export async function toggleGhostMode(userId: number, enabled: boolean) {
  const db = await getDb();
  await db.update(users).set({ ghostMode: enabled }).where(eq(users.id, userId));
}

export async function setTravelMode(userId: number, lat: number | null, lng: number | null, city: string | null) {
  const db = await getDb();
  await db.update(users).set({ travelModeLat: lat, travelModeLng: lng, travelModeCity: city }).where(eq(users.id, userId));
}

export async function addXp(userId: number, amount: number, opts?: { skipMultiplier?: boolean }) {
  const db = await getDb();
  let finalAmount = amount;
  if (!opts?.skipMultiplier) {
    // Premium users get 2x XP on all activities
    const [userRow] = await db.select({ isPremium: users.isPremium }).from(users).where(eq(users.id, userId)).limit(1);
    if (userRow?.isPremium) finalAmount *= 2;
    // Double XP Weekend event multiplier
    const [dxp] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "double_xp_active")).limit(1);
    if (dxp?.value === "true") finalAmount *= 2;
  }
  // Lazy weekly XP reset: if the current week (Monday start) has changed, reset weeklyXp
  // Use UTC to avoid server timezone drift
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7)); // roll back to Monday
  await db.update(users).set({
    xp: sql`${users.xp} + ${finalAmount}`,
    weeklyXp: sql`CASE WHEN ${users.weeklyXpResetAt} IS NULL OR ${users.weeklyXpResetAt} < ${monday} THEN ${finalAmount} ELSE ${users.weeklyXp} + ${finalAmount} END`,
    weeklyXpResetAt: sql`CASE WHEN ${users.weeklyXpResetAt} IS NULL OR ${users.weeklyXpResetAt} < ${monday} THEN NOW() ELSE ${users.weeklyXpResetAt} END`,
  }).where(eq(users.id, userId));
}

export async function claimDailyQuest(userId: number, questId: string, xp: number): Promise<{ success: boolean; alreadyClaimed?: boolean }> {
  const db = await getDb();
  // Check if already claimed today (UTC to avoid timezone drift)
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const existing = await db.select().from(questClaims)
    .where(and(
      eq(questClaims.userId, userId),
      eq(questClaims.questId, questId),
      sql`${questClaims.claimedAt} >= ${today}`
    )).limit(1);
  if (existing.length > 0) return { success: false, alreadyClaimed: true };
  try {
    await db.insert(questClaims).values({ userId, questId });
    await addXp(userId, xp);
    return { success: true };
  } catch (err: any) {
    // Handle race condition: duplicate insert from concurrent claims
    if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate')) {
      return { success: false, alreadyClaimed: true };
    }
    throw err;
  }
}

export async function getTodayClaimedQuests(userId: number): Promise<string[]> {
  const db = await getDb();
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const claims = await db.select({ questId: questClaims.questId }).from(questClaims)
    .where(and(eq(questClaims.userId, userId), sql`${questClaims.claimedAt} >= ${today}`));
  return claims.map(c => c.questId);
}

// =============================================================================
// SWIPE QUERIES
// =============================================================================

async function resetDailySwipesIfNeeded(db: any, userId: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Atomic reset: only updates if last swipe was before today, preventing race conditions
  await db.update(users).set({ swipesUsedToday: 0 }).where(
    and(
      eq(users.id, userId),
      sql`${users.swipesUsedToday} > 0`,
      sql`NOT EXISTS (
        SELECT 1 FROM ${swipes} WHERE ${swipes.swiperId} = ${userId} AND ${swipes.swipedAt} >= ${today}
      )`,
    )
  );
}

export async function getSuperRallyCountToday(userId: number) {
  const db = await getDb();
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const [result] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(swipes)
    .where(and(eq(swipes.swiperId, userId), eq(swipes.isSuperRally, true), sql`${swipes.swipedAt} >= ${todayUTC}`));
  return result?.count ?? 0;
}

export async function createSwipe(swiperId: number, swipedId: number, direction: "rally" | "pass", isSuperRally?: boolean) {
  const db = await getDb();

  await resetDailySwipesIfNeeded(db, swiperId);

  // Enforce daily swipe limit server-side (premium users get unlimited)
  const [user] = await db.select({ used: users.swipesUsedToday, max: users.maxDailySwipes, isPremium: users.isPremium }).from(users).where(eq(users.id, swiperId)).limit(1);
  if (user && !user.isPremium && user.used >= user.max) {
    throw new Error("Daily swipe limit reached");
  }

  return await db.transaction(async (tx) => {
    await tx.insert(swipes).values({ swiperId, swipedId, direction, isSuperRally: isSuperRally ?? false });

    // Update daily swipe count
    await tx.update(users).set({ swipesUsedToday: sql`${users.swipesUsedToday} + 1` }).where(eq(users.id, swiperId));

    if (direction === "rally") {
      // Check if the other user already swiped rally on us
      const mutual = await tx.select().from(swipes).where(
        and(eq(swipes.swiperId, swipedId), eq(swipes.swipedId, swiperId), eq(swipes.direction, "rally"))
      ).limit(1);

      if (mutual.length > 0) {
        // Create a match!
        await tx.insert(matches).values({ user1Id: Math.min(swiperId, swipedId), user2Id: Math.max(swiperId, swipedId) });

        // Increment totalMatches for both users
        await tx.update(users).set({ totalMatches: sql`${users.totalMatches} + 1` }).where(eq(users.id, swiperId));
        await tx.update(users).set({ totalMatches: sql`${users.totalMatches} + 1` }).where(eq(users.id, swipedId));

        // Create a conversation for the match
        const [convo] = await tx.insert(conversations).values({ type: "direct" }).$returningId();
        await tx.insert(conversationParticipants).values([
          { conversationId: convo.id, userId: swiperId },
          { conversationId: convo.id, userId: swipedId },
        ]);

        return { matched: true, matchedUserId: swipedId, conversationId: convo.id };
      }
    }

    return { matched: false };
  });
}

export async function getSwipesRemaining(userId: number) {
  const db = await getDb();
  await resetDailySwipesIfNeeded(db, userId);
  const result = await db.select({ used: users.swipesUsedToday, max: users.maxDailySwipes, isPremium: users.isPremium }).from(users).where(eq(users.id, userId)).limit(1);
  if (result.length === 0) return { remaining: 10, max: 10, isPremium: false };
  if (result[0].isPremium) return { remaining: Infinity, max: Infinity, isPremium: true };
  return { remaining: result[0].max - result[0].used, max: result[0].max, isPremium: false };
}

/** Get users who swiped "rally" on you (premium feature: See Who Liked You) */
export async function getWhoLikedYou(userId: number) {
  const db = await getDb();
  // Get rally swipes directed at this user, excluding users we've already swiped on (filtered in SQL)
  const alreadySwipedSubquery = db.select({ swipedId: swipes.swipedId }).from(swipes).where(eq(swipes.swiperId, userId));
  return db.select({
    id: users.id, nickname: users.nickname, name: users.name,
    profilePhotoUrl: users.profilePhotoUrl, skillLevel: users.skillLevel,
    city: users.city,
    isSuperRally: swipes.isSuperRally,
  }).from(swipes)
    .innerJoin(users, eq(swipes.swiperId, users.id))
    .where(and(
      eq(swipes.swipedId, userId),
      eq(swipes.direction, "rally"),
      sql`${swipes.swiperId} NOT IN (${alreadySwipedSubquery})`,
    ));
}

/** Activate profile boost (premium feature) */
export async function activateProfileBoost(userId: number) {
  const db = await getDb();
  const boostUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr boost
  // Atomic conditional update: only decrement if premium AND boosts > 0
  const [result] = await db.execute(sql`
    UPDATE ${users}
    SET ${users.profileBoostsRemaining} = ${users.profileBoostsRemaining} - 1,
        ${users.profileBoostedUntil} = ${boostUntil}
    WHERE ${users.id} = ${userId}
      AND ${users.isPremium} = true
      AND ${users.profileBoostsRemaining} > 0
  `);
  const affected = (result as any)?.affectedRows ?? 0;
  if (affected === 0) {
    // Determine reason
    const [user] = await db.select({ isPremium: users.isPremium, boosts: users.profileBoostsRemaining }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.isPremium) return { success: false, reason: "not-premium" };
    return { success: false, reason: "no-boosts-remaining" };
  }
  return { success: true, boostUntil };
}

// =============================================================================
// MATCH QUERIES
// =============================================================================

export async function getUserMatches(userId: number) {
  const db = await getDb();
  return db.select().from(matches).where(
    and(
      or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)),
      eq(matches.isActive, true),
    )
  );
}

export async function areUsersMatched(userId1: number, userId2: number): Promise<boolean> {
  const db = await getDb();
  const [match] = await db.select({ id: matches.id }).from(matches).where(
    and(
      eq(matches.isActive, true),
      or(
        and(eq(matches.user1Id, userId1), eq(matches.user2Id, userId2)),
        and(eq(matches.user1Id, userId2), eq(matches.user2Id, userId1)),
      )
    )
  ).limit(1);
  return !!match;
}

export async function unmatch(userId: number, matchId: number) {
  const db = await getDb();
  // Only allow unmatching if the user is part of this match
  const [match] = await db.select().from(matches).where(
    and(eq(matches.id, matchId), or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)))
  ).limit(1);
  if (!match) throw new Error("Match not found or you are not part of this match");
  await db.update(matches).set({ isActive: false, unmatchedBy: userId, unmatchedAt: new Date() }).where(eq(matches.id, matchId));
}

/** Get unmatched users for premium re-like feature */
export async function getUnmatchedUsers(userId: number) {
  const db = await getDb();
  const rows = await db.select().from(matches).where(
    and(
      or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)),
      eq(matches.isActive, false),
      eq(matches.unmatchedBy, userId),
    )
  ).orderBy(desc(matches.unmatchedAt));
  if (rows.length === 0) return [];
  const otherIds = rows.map(m => m.user1Id === userId ? m.user2Id : m.user1Id);
  const uniqueIds = Array.from(new Set(otherIds));
  const otherUsers = await db.select().from(users)
    .where(sql`${users.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`);
  const userMap = new Map(otherUsers.map(u => [u.id, u]));
  return rows.map(m => {
    const otherId = m.user1Id === userId ? m.user2Id : m.user1Id;
    const otherUser = userMap.get(otherId);
    if (!otherUser) return null;
    return { matchId: m.id, unmatchedAt: m.unmatchedAt, user: sanitizeUser(otherUser) };
  }).filter(Boolean);
}

/** Re-like a previously unmatched user */
export async function rematchUser(userId: number, matchId: number) {
  const db = await getDb();
  const [match] = await db.select().from(matches).where(
    and(eq(matches.id, matchId), eq(matches.unmatchedBy, userId), eq(matches.isActive, false))
  ).limit(1);
  if (!match) throw new Error("Match not found or cannot be re-liked");
  await db.update(matches).set({ isActive: true, unmatchedBy: null, unmatchedAt: null }).where(eq(matches.id, matchId));
  return { success: true };
}

// =============================================================================
// CONVERSATION / MESSAGE QUERIES
// =============================================================================

export async function isConversationParticipant(userId: number, conversationId: number): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(and(
      eq(conversationParticipants.conversationId, conversationId),
      eq(conversationParticipants.userId, userId),
      isNull(conversationParticipants.leftAt),
    ))
    .limit(1);
  if (row) return true;

  // Self-healing: if this is a group conversation and the user is an active group member,
  // auto-add them to the conversation (fixes missing conversationParticipants rows)
  const [convo] = await db.select({ type: conversations.type }).from(conversations)
    .where(eq(conversations.id, conversationId)).limit(1);
  if (convo?.type === "group") {
    const [group] = await db.select({ id: groups.id }).from(groups)
      .where(eq(groups.conversationId, conversationId)).limit(1);
    if (group) {
      const [member] = await db.select({ id: groupMembers.id }).from(groupMembers)
        .where(and(
          eq(groupMembers.groupId, group.id),
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true),
          eq(groupMembers.status, "active"),
        )).limit(1);
      if (member) {
        // Auto-add to conversation (self-heal)
        const existing = await db.select().from(conversationParticipants)
          .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)))
          .limit(1);
        if (existing.length > 0 && existing[0].leftAt) {
          await db.update(conversationParticipants).set({ leftAt: null }).where(eq(conversationParticipants.id, existing[0].id));
        } else if (existing.length === 0) {
          await db.insert(conversationParticipants).values({ conversationId, userId });
        }
        return true;
      }
    }
  }
  return false;
}

export async function getGameById(gameId: number) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  return game ?? null;
}

export async function isGameParticipant(userId: number, gameId: number): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ id: gameParticipants.id })
    .from(gameParticipants)
    .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId)))
    .limit(1);
  return !!row;
}

export async function isGroupMember(userId: number, groupId: number): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.isActive, true)))
    .limit(1);
  return !!row;
}

export async function getUserConversations(userId: number, limit: number = 50, cursor?: number) {
  const db = await getDb();
  const participantRows = await db.select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.userId, userId), isNull(conversationParticipants.leftAt)));
  if (participantRows.length === 0) return [];
  const ids = participantRows.map(r => r.conversationId);
  const conditions: any[] = [sql`${conversations.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`];
  if (cursor) conditions.push(sql`${conversations.id} < ${cursor}`);
  return db.select().from(conversations).where(and(...conditions)).orderBy(desc(conversations.lastMessageAt)).limit(limit);
}

export async function getMessages(conversationId: number, limit: number, cursor?: number) {
  const db = await getDb();
  const conditions = [eq(messages.conversationId, conversationId), eq(messages.isDeleted, false)];
  if (cursor) conditions.push(sql`${messages.id} < ${cursor}`);
  return db.select().from(messages).where(and(...conditions)).orderBy(desc(messages.sentAt)).limit(limit);
}

export async function sendMessage(senderId: number, data: {
  conversationId: number;
  content?: string;
  messageType?: "text" | "image" | "video" | "location_pin" | "system";
  locationLat?: number;
  locationLng?: number;
  locationName?: string;
}) {
  const db = await getDb();
  const [inserted] = await db.insert(messages).values({
    conversationId: data.conversationId,
    senderId,
    content: data.content,
    messageType: data.messageType ?? "text",
    locationLat: data.locationLat,
    locationLng: data.locationLng,
    locationName: data.locationName,
  });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, data.conversationId));
  return { id: inserted.insertId, conversationId: data.conversationId, senderId, content: data.content, messageType: data.messageType ?? "text", sentAt: new Date() };
}

export async function markConversationRead(userId: number, conversationId: number) {
  const db = await getDb();
  // Use SQL-native MAX(sentAt) so the comparison stays entirely within MySQL,
  // eliminating any JS↔MySQL timezone or DATETIME precision mismatches.
  // Falls back to NOW() if there are no messages yet.
  await db.execute(sql`
    UPDATE conversation_participants
    SET lastReadAt = COALESCE(
      (SELECT MAX(sentAt) FROM messages WHERE conversationId = ${conversationId} AND isDeleted = false),
      NOW()
    )
    WHERE conversationId = ${conversationId} AND userId = ${userId}
  `);
  // Mark individual messages as read (powers read receipt ✓✓ display).
  // Only marks messages sent by OTHER users that haven't been read yet.
  await db.execute(sql`
    UPDATE messages
    SET readAt = NOW()
    WHERE conversationId = ${conversationId}
      AND senderId != ${userId}
      AND readAt IS NULL
      AND isDeleted = false
  `);
}

/** Get or create a direct conversation between two users (premium feature) */
export async function getOrCreateDirectConversation(userId: number, targetUserId: number) {
  const db = await getDb();
  // Check if a direct conversation already exists between these two users
  // Wrapped in a transaction to prevent duplicate conversations from concurrent requests
  return db.transaction(async (tx) => {
    const myConvos = await tx.select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId));
    if (myConvos.length > 0) {
      const myConvoIds = myConvos.map(c => c.conversationId);
      const shared = await tx.select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
        .where(and(
          eq(conversationParticipants.userId, targetUserId),
          eq(conversations.type, "direct"),
          sql`${conversationParticipants.conversationId} IN (${sql.join(myConvoIds.map(id => sql`${id}`), sql`, `)})`,
        ))
        .limit(1);
      if (shared.length > 0) return { conversationId: shared[0].conversationId, created: false };
    }
    // Create new conversation
    const [convo] = await tx.insert(conversations).values({ type: "direct" }).$returningId();
    await tx.insert(conversationParticipants).values([
      { conversationId: convo.id, userId },
      { conversationId: convo.id, userId: targetUserId },
    ]);
    return { conversationId: convo.id, created: true };
  });
}

// =============================================================================
// COURT QUERIES
// =============================================================================

export async function getCourts(filters?: { lat?: number; lng?: number; radiusMiles?: number; courtType?: string; isFree?: boolean }) {
  const db = await getDb();
  const conditions: any[] = [];
  if (filters?.courtType && filters.courtType !== "both") {
    conditions.push(eq(courts.courtType, filters.courtType as any));
  }
  if (filters?.isFree !== undefined) {
    conditions.push(eq(courts.isFree, filters.isFree));
  }
  return db.select().from(courts).where(conditions.length > 0 ? and(...conditions) : undefined);
}

export async function getCourtById(courtId: number) {
  const db = await getDb();
  const result = await db.select().from(courts).where(eq(courts.id, courtId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCourtReviews(courtId: number) {
  const db = await getDb();
  return db.select().from(courtReviews).where(eq(courtReviews.courtId, courtId)).orderBy(desc(courtReviews.createdAt));
}

export async function addCourtReview(userId: number, data: { courtId: number; rating: number; comment?: string }) {
  const db = await getDb();
  // Prevent duplicate reviews per user per court
  const existing = await db.select({ id: courtReviews.id }).from(courtReviews)
    .where(and(eq(courtReviews.courtId, data.courtId), eq(courtReviews.userId, userId))).limit(1);
  if (existing.length > 0) throw Object.assign(new Error("You have already reviewed this court"), { code: "DUPLICATE" });
  await db.transaction(async (tx) => {
    await tx.insert(courtReviews).values({ courtId: data.courtId, userId, rating: data.rating, comment: data.comment });
    // Update court average rating
    const reviews = await tx.select({ avg: sql<number>`AVG(${courtReviews.rating})`, count: sql<number>`COUNT(*)` })
      .from(courtReviews).where(eq(courtReviews.courtId, data.courtId));
    if (reviews.length > 0) {
      await tx.update(courts).set({ averageRating: reviews[0].avg, totalReviews: reviews[0].count }).where(eq(courts.id, data.courtId));
    }
  });
}

// =============================================================================
// COURT SUBMISSIONS
// =============================================================================

export async function submitCourt(userId: number, data: {
  name: string; address?: string; latitude: number; longitude: number;
  city?: string; state?: string; courtType?: "indoor" | "outdoor" | "both";
  numCourts?: number; surfaceType?: string; lighting?: boolean; isFree?: boolean;
  costInfo?: string; amenities?: string; photoUrl?: string; notes?: string;
}) {
  const db = await getDb();
  const [result] = await db.insert(courtSubmissions).values({ submittedBy: userId, ...data });
  return { id: Number(result.insertId) };
}

export async function getUserCourtSubmissions(userId: number) {
  const db = await getDb();
  return db.select().from(courtSubmissions)
    .where(eq(courtSubmissions.submittedBy, userId))
    .orderBy(desc(courtSubmissions.createdAt));
}

export async function getPendingCourtSubmissions() {
  const db = await getDb();
  const rows = await db.select({
    submission: courtSubmissions,
    submitterName: users.name,
    submitterEmail: users.email,
  })
    .from(courtSubmissions)
    .leftJoin(users, eq(users.id, courtSubmissions.submittedBy))
    .orderBy(desc(courtSubmissions.createdAt));
  return rows.map(r => ({
    ...r.submission,
    submitterName: r.submitterName,
    submitterEmail: r.submitterEmail,
  }));
}

export async function reviewCourtSubmission(adminId: number, data: {
  submissionId: number; action: "approved" | "rejected"; adminNotes?: string;
  name?: string; address?: string; latitude?: number; longitude?: number;
  city?: string; state?: string; courtType?: "indoor" | "outdoor" | "both";
  numCourts?: number; surfaceType?: string; lighting?: boolean; isFree?: boolean;
  costInfo?: string; amenities?: string;
}) {
  const db = await getDb();
  const [sub] = await db.select().from(courtSubmissions).where(eq(courtSubmissions.id, data.submissionId)).limit(1);
  if (!sub) throw new Error("Submission not found");
  if (sub.status !== "pending") throw new Error("Submission already reviewed");

  // Update the submission status
  await db.update(courtSubmissions).set({
    status: data.action,
    adminNotes: data.adminNotes,
    reviewedBy: adminId,
    reviewedAt: new Date(),
  }).where(eq(courtSubmissions.id, data.submissionId));

  // If approved, create the court (applying any admin edits)
  if (data.action === "approved") {
    const courtData = {
      name: data.name ?? sub.name,
      address: data.address ?? sub.address,
      latitude: data.latitude ?? sub.latitude,
      longitude: data.longitude ?? sub.longitude,
      city: data.city ?? sub.city,
      state: data.state ?? sub.state,
      courtType: (data.courtType ?? sub.courtType) as "indoor" | "outdoor" | "both",
      numCourts: data.numCourts ?? sub.numCourts,
      surfaceType: data.surfaceType ?? sub.surfaceType,
      lighting: data.lighting ?? sub.lighting,
      isFree: data.isFree ?? sub.isFree,
      costInfo: data.costInfo ?? sub.costInfo,
      amenities: data.amenities ?? sub.amenities,
      addedBy: sub.submittedBy,
      isVerified: true,
    };
    await db.insert(courts).values(courtData);

    // Award achievement check for the submitter
    checkAndAwardAchievements(sub.submittedBy).catch(() => {});
  }

  return { success: true };
}

export async function getCourtSubmissionCount(userId: number) {
  const db = await getDb();
  const [result] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(courtSubmissions)
    .where(and(eq(courtSubmissions.submittedBy, userId), eq(courtSubmissions.status, "approved")));
  return result?.count ?? 0;
}

// =============================================================================
// GAME QUERIES
// =============================================================================

export async function getUserGames(userId: number, status?: string) {
  const db = await getDb();
  const participantRows = await db.select({ gameId: gameParticipants.gameId })
    .from(gameParticipants)
    .where(eq(gameParticipants.userId, userId));
  const organizedRows = await db.select({ id: games.id }).from(games).where(eq(games.organizerId, userId));
  const gameIdSet = new Set([...participantRows.map(r => r.gameId), ...organizedRows.map(r => r.id)]);
  const allGameIds = Array.from(gameIdSet);
  if (allGameIds.length === 0) return [];
  const conditions: any[] = [sql`${games.id} IN (${sql.join(allGameIds.map(id => sql`${id}`), sql`, `)})`];
  if (status) conditions.push(eq(games.status, status as any));
  return db.select().from(games).where(and(...conditions)).orderBy(desc(games.scheduledAt));
}

export async function createGame(organizerId: number, data: {
  courtId?: number; locationName?: string; scheduledAt: string; durationMinutes?: number;
  gameType?: "casual" | "competitive" | "tournament" | "practice";
  format?: "singles" | "mens-doubles" | "womens-doubles" | "mixed-doubles";
  maxPlayers?: number; skillLevelMin?: string; skillLevelMax?: string; notes?: string;
  isOpen?: boolean; groupId?: number;
}) {
  const db = await getDb();
  // Validate court exists if courtId is provided
  if (data.courtId) {
    const [court] = await db.select({ id: courts.id }).from(courts).where(eq(courts.id, data.courtId)).limit(1);
    if (!court) throw new Error("Court not found");
  }
  return await db.transaction(async (tx) => {
    const [game] = await tx.insert(games).values({
      organizerId,
      groupId: data.groupId ?? null,
      courtId: data.courtId,
      locationName: data.locationName,
      scheduledAt: new Date(data.scheduledAt),
      durationMinutes: data.durationMinutes ?? 90,
      gameType: data.gameType ?? "casual",
      format: data.format ?? "mixed-doubles",
      maxPlayers: data.maxPlayers ?? 4,
      skillLevelMin: data.skillLevelMin,
      skillLevelMax: data.skillLevelMax,
      isOpen: data.isOpen ?? true,
      notes: data.notes,
    }).$returningId();
    // Auto-join the organizer
    await tx.insert(gameParticipants).values({ gameId: game.id, userId: organizerId, status: "confirmed" });
    // If linked to a group, auto-invite active group members (excluding organizer)
    if (data.groupId) {
      const activeMembers = await tx.select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(and(
          eq(groupMembers.groupId, data.groupId),
          eq(groupMembers.status, "active"),
          eq(groupMembers.isActive, true),
        ));
      const otherMembers = activeMembers.filter(m => m.userId !== organizerId);
      if (otherMembers.length > 0) {
        await tx.insert(gameParticipants).values(
          otherMembers.map(m => ({ gameId: game.id, userId: m.userId, status: "confirmed" as const }))
        );
      }
    }
    return game;
  });
}

export async function joinGame(userId: number, gameId: number) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Get game and validate — FOR UPDATE to prevent capacity race condition
    const [game] = await tx.select().from(games).where(eq(games.id, gameId)).for("update").limit(1);
    if (!game) throw new Error("Game not found");
    if (game.status !== "scheduled") throw new Error("Game is not accepting new players");
    if (game.organizerId === userId) throw new Error("You are the organizer of this game");

    // Check capacity
    const [countResult] = await tx.select({ count: sql<number>`COUNT(*)` })
      .from(gameParticipants).where(eq(gameParticipants.gameId, gameId));
    if (countResult.count >= game.maxPlayers) throw new Error("Game is full");

    // Prevent duplicate
    const existing = await tx.select({ id: gameParticipants.id })
      .from(gameParticipants)
      .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId)))
      .limit(1);
    if (existing.length > 0) throw new Error("Already a participant");

    await tx.insert(gameParticipants).values({ gameId, userId, status: "pending" });
  });

  // Notify game organizer (after successful transaction)
  try {
    const [game] = await db.select({ organizerId: games.organizerId, locationName: games.locationName }).from(games).where(eq(games.id, gameId)).limit(1);
    if (game) {
      const joiner = await db.select({ nickname: users.nickname, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      const joinerName = joiner[0]?.nickname || joiner[0]?.name || "Someone";
      await createNotification(game.organizerId, {
        type: "game_invite",
        title: "Game Join Request",
        content: `${joinerName} wants to join your game${game.locationName ? ` at ${game.locationName}` : ""}`,
        link: "game-history",
        targetId: gameId,
      });
    }
  } catch (e) {
    // Don't fail the join if notification fails
    console.error("Failed to send join notification:", e);
  }
}

/** Approve a pending game participant (organizer only) */
export async function approveGameParticipant(organizerId: number, gameId: number, userId: number) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game || game.organizerId !== organizerId) throw new Error("Only the organizer can approve participants");
  const [participant] = await db.select().from(gameParticipants)
    .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId)))
    .limit(1);
  if (!participant) throw new Error("Participant not found");
  if (participant.status !== "pending") throw new Error("Participant is not pending");
  await db.update(gameParticipants).set({ status: "confirmed" }).where(eq(gameParticipants.id, participant.id));
  // Auto-close if now full
  const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(gameParticipants).where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.status, "confirmed")));
  if (countResult.count >= game.maxPlayers) {
    await db.update(games).set({ isOpen: false }).where(eq(games.id, gameId));
  }
}

/** Decline a pending game participant (organizer only) */
export async function declineGameParticipant(organizerId: number, gameId: number, userId: number) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game || game.organizerId !== organizerId) throw new Error("Only the organizer can decline participants");
  await db.update(gameParticipants).set({ status: "declined" })
    .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId)));
}

export async function leaveGame(userId: number, gameId: number) {
  const db = await getDb();
  await db.delete(gameParticipants).where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId)));
}

export async function updateGame(organizerId: number, gameId: number, data: { status?: string; notes?: string; maxPlayers?: number }) {
  const db = await getDb();
  const updateSet: Record<string, unknown> = {};
  if (data.status) {
    updateSet.status = data.status;
    if (data.status === "completed" || data.status === "cancelled") {
      updateSet.isOpen = false;
    }
  }
  if (data.notes !== undefined) updateSet.notes = data.notes;
  if (data.maxPlayers !== undefined) updateSet.maxPlayers = data.maxPlayers;
  if (Object.keys(updateSet).length === 0) return;
  await db.update(games).set(updateSet as any).where(and(eq(games.id, gameId), eq(games.organizerId, organizerId)));

  // When a game is completed, increment totalGames for all participants
  if (data.status === "completed") {
    const participants = await db.select({ userId: gameParticipants.userId }).from(gameParticipants).where(eq(gameParticipants.gameId, gameId));
    if (participants.length > 0) {
      const participantIds = participants.map(p => p.userId);
      await db.update(users).set({ totalGames: sql`${users.totalGames} + 1` })
        .where(sql`${users.id} IN (${sql.join(participantIds.map(id => sql`${id}`), sql`, `)})`);
    }
  }
}

export async function giveGameFeedback(reviewerId: number, data: {
  gameId: number; reviewedId: number; rating: number;
  skillAccurate?: boolean; goodSport?: boolean; onTime?: boolean; wouldPlayAgain?: boolean; comment?: string;
}) {
  const db = await getDb();
  // Prevent duplicate feedback for same reviewer/reviewed/game
  const existing = await db.select({ id: gameFeedback.id }).from(gameFeedback)
    .where(and(
      eq(gameFeedback.gameId, data.gameId),
      eq(gameFeedback.reviewerId, reviewerId),
      eq(gameFeedback.reviewedId, data.reviewedId),
    )).limit(1);
  if (existing.length > 0) throw Object.assign(new Error("Feedback already submitted for this player"), { code: "DUPLICATE" });
  await db.insert(gameFeedback).values({
    gameId: data.gameId,
    reviewerId,
    reviewedId: data.reviewedId,
    rating: data.rating,
    skillAccurate: data.skillAccurate ?? true,
    goodSport: data.goodSport ?? true,
    onTime: data.onTime ?? true,
    wouldPlayAgain: data.wouldPlayAgain ?? true,
    comment: data.comment,
  });
  // Update reviewed user's average rating
  const ratings = await db.select({ avg: sql<number>`AVG(${gameFeedback.rating})` })
    .from(gameFeedback).where(eq(gameFeedback.reviewedId, data.reviewedId));
  if (ratings.length > 0 && ratings[0].avg != null) {
    await db.update(users).set({ averageRating: ratings[0].avg }).where(eq(users.id, data.reviewedId));
  }
}

// =============================================================================
// ACHIEVEMENT QUERIES
// =============================================================================

export async function getUserAchievements(userId: number) {
  const db = await getDb();
  return db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
}

export async function getAllAchievements() {
  const db = await getDb();
  return db.select().from(achievements);
}

// Achievement seed definitions
const ACHIEVEMENT_SEEDS = [
  // Social achievements
  { name: "First Rally", description: "Swipe rally on your first player", icon: "🤝", category: "social" as const, points: 50, requirementType: "matches", requirementValue: 1 },
  { name: "Social Butterfly", description: "Match with 5 players", icon: "🦋", category: "social" as const, points: 100, requirementType: "matches", requirementValue: 5 },
  { name: "Networking Pro", description: "Match with 25 players", icon: "🌐", category: "social" as const, points: 250, requirementType: "matches", requirementValue: 25 },
  { name: "Social Star", description: "Match with 50 players", icon: "⭐", category: "social" as const, points: 400, requirementType: "matches", requirementValue: 50 },
  { name: "Connector", description: "Match with 100 players", icon: "🔗", category: "social" as const, points: 600, requirementType: "matches", requirementValue: 100 },
  { name: "Ice Breaker", description: "Send your first message", icon: "💬", category: "social" as const, points: 50, requirementType: "messages_sent", requirementValue: 1 },
  { name: "Chatty Player", description: "Send 50 messages", icon: "📱", category: "social" as const, points: 150, requirementType: "messages_sent", requirementValue: 50 },
  { name: "Conversation King", description: "Send 200 messages", icon: "👑", category: "social" as const, points: 300, requirementType: "messages_sent", requirementValue: 200 },
  { name: "Community Voice", description: "Send 500 messages", icon: "📣", category: "social" as const, points: 500, requirementType: "messages_sent", requirementValue: 500 },
  // Games achievements
  { name: "Game On!", description: "Play your first game", icon: "🏓", category: "games" as const, points: 75, requirementType: "games_played", requirementValue: 1 },
  { name: "Regular Player", description: "Play 10 games", icon: "🔥", category: "games" as const, points: 200, requirementType: "games_played", requirementValue: 10 },
  { name: "Veteran", description: "Play 50 games", icon: "🏅", category: "games" as const, points: 500, requirementType: "games_played", requirementValue: 50 },
  { name: "Centurion", description: "Play 100 games", icon: "💯", category: "games" as const, points: 750, requirementType: "games_played", requirementValue: 100 },
  { name: "Marathon Player", description: "Play 250 games", icon: "🏃", category: "games" as const, points: 1000, requirementType: "games_played", requirementValue: 250 },
  { name: "Game Organizer", description: "Create your first game", icon: "📋", category: "games" as const, points: 100, requirementType: "games_created", requirementValue: 1 },
  { name: "Tournament Director", description: "Create 10 games", icon: "🎪", category: "games" as const, points: 300, requirementType: "games_created", requirementValue: 10 },
  { name: "Event Master", description: "Create 25 games", icon: "🎯", category: "games" as const, points: 500, requirementType: "games_created", requirementValue: 25 },
  { name: "First Win", description: "Win your first game", icon: "🏆", category: "games" as const, points: 100, requirementType: "games_won", requirementValue: 1 },
  { name: "Winning Streak", description: "Win 10 games", icon: "🥇", category: "games" as const, points: 300, requirementType: "games_won", requirementValue: 10 },
  { name: "Dominant Force", description: "Win 50 games", icon: "💪", category: "games" as const, points: 600, requirementType: "games_won", requirementValue: 50 },
  { name: "Unstoppable", description: "Win 100 games", icon: "⚡", category: "games" as const, points: 1000, requirementType: "games_won", requirementValue: 100 },
  { name: "Streak Master", description: "Reach a 7-day login streak", icon: "🔥", category: "games" as const, points: 200, requirementType: "streak", requirementValue: 7 },
  { name: "Streak Legend", description: "Reach a 30-day login streak", icon: "🌋", category: "games" as const, points: 500, requirementType: "streak", requirementValue: 30 },
  { name: "Always On", description: "Reach a 60-day login streak", icon: "☀️", category: "games" as const, points: 800, requirementType: "streak", requirementValue: 60 },
  // Profile achievements
  { name: "Picture Perfect", description: "Upload a profile photo", icon: "📸", category: "profile" as const, points: 50, requirementType: "has_photo", requirementValue: 1 },
  { name: "All About Me", description: "Complete your profile to 80%", icon: "✍️", category: "profile" as const, points: 100, requirementType: "profile_completion", requirementValue: 80 },
  { name: "Fully Loaded", description: "Complete your profile to 100%", icon: "🎯", category: "profile" as const, points: 200, requirementType: "profile_completion", requirementValue: 100 },
  { name: "Level 5", description: "Reach level 5", icon: "⭐", category: "profile" as const, points: 150, requirementType: "level", requirementValue: 5 },
  { name: "Level 10", description: "Reach level 10", icon: "🌟", category: "profile" as const, points: 300, requirementType: "level", requirementValue: 10 },
  { name: "Level 15", description: "Reach level 15", icon: "✨", category: "profile" as const, points: 500, requirementType: "level", requirementValue: 15 },
  { name: "Level 20", description: "Reach level 20", icon: "💫", category: "profile" as const, points: 750, requirementType: "level", requirementValue: 20 },
  { name: "Level 25", description: "Reach the maximum level", icon: "🌈", category: "profile" as const, points: 1500, requirementType: "level", requirementValue: 25 },
  { name: "XP Collector", description: "Earn 1000 XP total", icon: "💎", category: "profile" as const, points: 200, requirementType: "xp", requirementValue: 1000 },
  { name: "XP Hoarder", description: "Earn 5000 XP total", icon: "💰", category: "profile" as const, points: 400, requirementType: "xp", requirementValue: 5000 },
  { name: "XP Mogul", description: "Earn 15000 XP total", icon: "🏦", category: "profile" as const, points: 600, requirementType: "xp", requirementValue: 15000 },
  { name: "XP Titan", description: "Earn 50000 XP total", icon: "👑", category: "profile" as const, points: 1000, requirementType: "xp", requirementValue: 50000 },
  // Community achievements
  { name: "Team Player", description: "Join your first group", icon: "👥", category: "community" as const, points: 75, requirementType: "groups_joined", requirementValue: 1 },
  { name: "Social Circle", description: "Join 3 groups", icon: "🫂", category: "community" as const, points: 150, requirementType: "groups_joined", requirementValue: 3 },
  { name: "Community Pillar", description: "Join 10 groups", icon: "🏛️", category: "community" as const, points: 300, requirementType: "groups_joined", requirementValue: 10 },
  { name: "Group Leader", description: "Create a group", icon: "👑", category: "community" as const, points: 100, requirementType: "groups_created", requirementValue: 1 },
  { name: "Coalition Builder", description: "Create 3 groups", icon: "🏗️", category: "community" as const, points: 250, requirementType: "groups_created", requirementValue: 3 },
  { name: "Coach's Pet", description: "Join a coaching session", icon: "🎓", category: "community" as const, points: 100, requirementType: "coaching_joined", requirementValue: 1 },
  { name: "Dedicated Student", description: "Join 5 coaching sessions", icon: "📚", category: "community" as const, points: 250, requirementType: "coaching_joined", requirementValue: 5 },
  { name: "Coaching Veteran", description: "Join 20 coaching sessions", icon: "🧑‍🏫", category: "community" as const, points: 500, requirementType: "coaching_joined", requirementValue: 20 },
  { name: "Court Critic", description: "Review 3 courts", icon: "⭐", category: "community" as const, points: 75, requirementType: "court_reviews", requirementValue: 3 },
  { name: "Court Connoisseur", description: "Review 10 courts", icon: "🏟️", category: "community" as const, points: 200, requirementType: "court_reviews", requirementValue: 10 },
  { name: "Endorser", description: "Endorse 5 players", icon: "👍", category: "community" as const, points: 100, requirementType: "endorsements_given", requirementValue: 5 },
  { name: "Hype Machine", description: "Endorse 25 players", icon: "📢", category: "community" as const, points: 250, requirementType: "endorsements_given", requirementValue: 25 },
  { name: "Community Champion", description: "Endorse 50 players", icon: "🏆", category: "community" as const, points: 500, requirementType: "endorsements_given", requirementValue: 50 },
  { name: "Feedback Giver", description: "Rate 5 games", icon: "📝", category: "community" as const, points: 100, requirementType: "feedback_given", requirementValue: 5 },
  { name: "Feedback Pro", description: "Rate 25 games", icon: "📊", category: "community" as const, points: 250, requirementType: "feedback_given", requirementValue: 25 },
  { name: "Well Endorsed", description: "Receive 10 endorsements", icon: "🌟", category: "community" as const, points: 200, requirementType: "endorsements_received", requirementValue: 10 },
  { name: "Fan Favorite", description: "Receive 50 endorsements", icon: "🎉", category: "community" as const, points: 500, requirementType: "endorsements_received", requirementValue: 50 },
  // Onboarding
  { name: "Rookie Ready", description: "Complete the onboarding tutorial", icon: "🎓", category: "profile" as const, points: 50, requirementType: "onboarding_completed", requirementValue: 1 },
  // Court Submissions
  { name: "Court Scout", description: "Submit your first court", icon: "🗺️", category: "community" as const, points: 100, requirementType: "courts_submitted", requirementValue: 1 },
  { name: "Court Explorer", description: "Get 3 court submissions approved", icon: "🧭", category: "community" as const, points: 250, requirementType: "courts_approved", requirementValue: 3 },
  { name: "Court Cartographer", description: "Get 10 court submissions approved", icon: "📍", category: "community" as const, points: 500, requirementType: "courts_approved", requirementValue: 10 },
  { name: "Court Legend", description: "Get 25 court submissions approved", icon: "🏛️", category: "community" as const, points: 1000, requirementType: "courts_approved", requirementValue: 25 },
  // Tournament achievements
  { name: "Tournament Rookie", description: "Enter your first tournament", icon: "🎟️", category: "games" as const, points: 100, requirementType: "tournaments_entered", requirementValue: 1 },
  { name: "Tournament Regular", description: "Enter 5 tournaments", icon: "🎪", category: "games" as const, points: 250, requirementType: "tournaments_entered", requirementValue: 5 },
  { name: "Tournament Veteran", description: "Enter 15 tournaments", icon: "⚔️", category: "games" as const, points: 500, requirementType: "tournaments_entered", requirementValue: 15 },
  { name: "Champion!", description: "Win your first tournament", icon: "🏆", category: "games" as const, points: 300, requirementType: "tournaments_won", requirementValue: 1 },
  { name: "Serial Champion", description: "Win 3 tournaments", icon: "👑", category: "games" as const, points: 750, requirementType: "tournaments_won", requirementValue: 3 },
  { name: "Dynasty", description: "Win 10 tournaments", icon: "🏰", category: "games" as const, points: 1500, requirementType: "tournaments_won", requirementValue: 10 },
  { name: "Tournament Host", description: "Organize your first tournament", icon: "📋", category: "community" as const, points: 150, requirementType: "tournaments_organized", requirementValue: 1 },
  { name: "Event Promoter", description: "Organize 5 tournaments", icon: "🎤", category: "community" as const, points: 400, requirementType: "tournaments_organized", requirementValue: 5 },
];

/** Seed achievements into the database (idempotent) */
export async function seedAchievements() {
  const db = await getDb();
  const existing = await db.select({ name: achievements.name }).from(achievements);
  const existingNames = new Set(existing.map(a => a.name));
  const toInsert = ACHIEVEMENT_SEEDS.filter(a => !existingNames.has(a.name));
  if (toInsert.length > 0) {
    await db.insert(achievements).values(toInsert);
    console.log(`[Achievements] Seeded ${toInsert.length} new achievements`);
  }
}

// Court seed definitions
const COURT_SEEDS = [
  { name: "Sunset Recreation Center", address: "2120 SW Park Ave, Portland, OR 97201", latitude: 45.5122, longitude: -122.6857, city: "Portland", state: "Oregon", courtType: "outdoor" as const, numCourts: 6, surfaceType: "concrete", lighting: true, isFree: true, amenities: "Restrooms, Water fountain, Bench seating, Parking" },
  { name: "Central Park Pickleball Courts", address: "1500 NE Broadway St, Portland, OR 97232", latitude: 45.5350, longitude: -122.6450, city: "Portland", state: "Oregon", courtType: "outdoor" as const, numCourts: 4, surfaceType: "asphalt", lighting: true, isFree: true, amenities: "Parking, Restrooms, Shade areas" },
  { name: "Metro Indoor Sports", address: "8450 SW Nimbus Ave, Beaverton, OR 97008", latitude: 45.4737, longitude: -122.7812, city: "Beaverton", state: "Oregon", courtType: "indoor" as const, numCourts: 8, surfaceType: "sport court", lighting: true, isFree: false, costInfo: "$10/hour per court", amenities: "Pro shop, Locker rooms, Snack bar, Equipment rental" },
  { name: "Riverside Athletic Club", address: "3600 SE Hawthorne Blvd, Portland, OR 97214", latitude: 45.5118, longitude: -122.6260, city: "Portland", state: "Oregon", courtType: "indoor" as const, numCourts: 4, surfaceType: "hardwood", lighting: true, isFree: false, costInfo: "Member access or $15 day pass", amenities: "Locker rooms, Showers, Equipment rental, Coaching" },
  { name: "Westside Community Park", address: "9200 SW Allen Blvd, Beaverton, OR 97005", latitude: 45.4820, longitude: -122.7931, city: "Beaverton", state: "Oregon", courtType: "outdoor" as const, numCourts: 3, surfaceType: "concrete", lighting: false, isFree: true, amenities: "Parking, Benches, Playground nearby" },
  { name: "Tualatin Hills Recreation Ctr", address: "15707 SW Walker Rd, Beaverton, OR 97006", latitude: 45.5060, longitude: -122.8270, city: "Beaverton", state: "Oregon", courtType: "both" as const, numCourts: 6, surfaceType: "sport court", lighting: true, isFree: false, costInfo: "$5/person for 2hr session", amenities: "Indoor & outdoor courts, Pro shop, Lessons, Restrooms" },
  { name: "East Portland Community Center", address: "740 SE 106th Ave, Portland, OR 97216", latitude: 45.5153, longitude: -122.5560, city: "Portland", state: "Oregon", courtType: "indoor" as const, numCourts: 3, surfaceType: "gym floor", lighting: true, isFree: false, costInfo: "$3 drop-in", amenities: "Restrooms, Showers, Vending machines" },
  { name: "Grant Park Outdoor Courts", address: "2820 NE 33rd Ave, Portland, OR 97212", latitude: 45.5430, longitude: -122.6310, city: "Portland", state: "Oregon", courtType: "outdoor" as const, numCourts: 4, surfaceType: "concrete", lighting: true, isFree: true, amenities: "Parking, Restrooms, Water, Picnic area" },
  { name: "Willamette Park Courts", address: "4715 SW Macadam Ave, Portland, OR 97239", latitude: 45.4820, longitude: -122.6710, city: "Portland", state: "Oregon", courtType: "outdoor" as const, numCourts: 2, surfaceType: "asphalt", lighting: false, isFree: true, amenities: "River views, Parking, Restrooms" },
  { name: "Lake Oswego Indoor Club", address: "2600 SW Country Club Rd, Lake Oswego, OR 97034", latitude: 45.4190, longitude: -122.7060, city: "Lake Oswego", state: "Oregon", courtType: "indoor" as const, numCourts: 5, surfaceType: "sport court", lighting: true, isFree: false, costInfo: "$20/hour court rental", amenities: "Pro coaching, Equipment rental, Lounge, Café" },
  { name: "Pioneer Square Downtown Courts", address: "701 SW 6th Ave, Portland, OR 97204", latitude: 45.5189, longitude: -122.6790, city: "Portland", state: "Oregon", courtType: "outdoor" as const, numCourts: 2, surfaceType: "concrete", lighting: true, isFree: true, amenities: "Downtown location, Transit accessible" },
  { name: "Clackamas Town Center Courts", address: "12000 SE 82nd Ave, Happy Valley, OR 97086", latitude: 45.4369, longitude: -122.5720, city: "Happy Valley", state: "Oregon", courtType: "both" as const, numCourts: 6, surfaceType: "sport court", lighting: true, isFree: false, costInfo: "$8/person", amenities: "Indoor & outdoor, Equipment rental, Parking, Tournaments" },
];

/** Seed courts into the database (idempotent) */
export async function seedCourts() {
  const db = await getDb();
  const existing = await db.select({ name: courts.name }).from(courts);
  const existingNames = new Set(existing.map(c => c.name));
  const toInsert = COURT_SEEDS.filter(c => !existingNames.has(c.name));
  if (toInsert.length > 0) {
    await db.insert(courts).values(toInsert);
    console.log(`[Courts] Seeded ${toInsert.length} new courts`);
  }
}

/** Seed test accounts (admin + premium) — idempotent */
export async function seedTestAccounts() {
  const db = await getDb();
  const { randomBytes, scryptSync } = await import("crypto");

  const testAccounts = [
    { email: "admin@pkl.test", username: "pkladmin", name: "PKL Admin", role: "admin" as const, isPremium: false },
    { email: "premium@pkl.test", username: "pklpremium", name: "PKL Premium", role: "user" as const, isPremium: true },
  ];

  for (const acct of testAccounts) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, acct.email)).limit(1);
    if (existing.length > 0) {
      // Ensure role and premium status are up to date
      await db.update(users).set({ role: acct.role, isPremium: acct.isPremium, ...(acct.isPremium ? { premiumUntil: new Date("2030-01-01") } : {}) })
        .where(eq(users.id, existing[0].id));
      continue;
    }
    const salt = randomBytes(32).toString("hex");
    const derivedKey = scryptSync("TestPass123!", salt, 64).toString("hex");
    const hashedPassword = `${salt}:${derivedKey}`;
    const openId = `email-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await db.insert(users).values({
      openId,
      email: acct.email,
      username: acct.username,
      name: acct.name,
      passwordHash: hashedPassword,
      loginMethod: "email",
      role: acct.role,
      isPremium: acct.isPremium,
      ...(acct.isPremium ? { premiumUntil: new Date("2030-01-01") } : {}),
      onboardingCompleted: true,
      lastSignedIn: new Date(),
    });
    console.log(`[TestAccounts] Created ${acct.role}${acct.isPremium ? "+premium" : ""} account: ${acct.email}`);
  }
}

/** Award an achievement to a user (idempotent) */
export async function awardAchievement(userId: number, achievementId: number) {
  const db = await getDb();
  // Check if already earned
  const existing = await db.select().from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)))
    .limit(1);
  if (existing.length > 0 && existing[0].earnedAt) return false; // Already earned
  if (existing.length > 0) {
    // Update progress to complete
    await db.update(userAchievements).set({ earnedAt: new Date(), progress: existing[0].maxProgress })
      .where(eq(userAchievements.id, existing[0].id));
  } else {
    await db.insert(userAchievements).values({
      userId, achievementId, earnedAt: new Date(), progress: 1, maxProgress: 1,
    });
  }
  // XP is awarded when the user claims the achievement (not auto-granted)
  // Notify the user about the achievement
  const [achInfo] = await db.select({ name: achievements.name }).from(achievements).where(eq(achievements.id, achievementId)).limit(1);
  await createNotification(userId, {
    type: "achievement",
    title: "Achievement Unlocked! 🏆",
    content: achInfo?.name ? `You earned "${achInfo.name}"! Tap to claim your XP.` : "You unlocked a new achievement!",
    link: "/achievements",
  });
  return true;
}

/** Claim an earned achievement to receive XP */
export async function claimAchievement(userId: number, achievementId: number) {
  const db = await getDb();
  const [ua] = await db.select().from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)))
    .limit(1);
  if (!ua || !ua.earnedAt) return { success: false, reason: "not-earned" };
  if (ua.claimedAt) return { success: false, reason: "already-claimed" };
  const [achiev] = await db.select({ points: achievements.points }).from(achievements).where(eq(achievements.id, achievementId)).limit(1);
  // Use conditional update to prevent race condition — only claim if not yet claimed
  const updated = await db.update(userAchievements).set({ claimedAt: new Date() })
    .where(and(eq(userAchievements.id, ua.id), isNull(userAchievements.claimedAt)));
  const affectedRows = (updated as any)?.[0]?.affectedRows ?? (updated as any)?.rowsAffected ?? 0;
  if (affectedRows === 0) return { success: false, reason: "already-claimed" };
  if (achiev?.points) {
    await addXp(userId, achiev.points);
  }
  // Return actual XP awarded (premium users get 2x from addXp)
  const [userRow] = await db.select({ isPremium: users.isPremium }).from(users).where(eq(users.id, userId)).limit(1);
  const actualXp = (achiev?.points ?? 0) * (userRow?.isPremium ? 2 : 1);
  return { success: true, xpAwarded: actualXp };
}

/** Update progress on an achievement without awarding (for progress tracking) */
async function updateAchievementProgress(userId: number, achievementId: number, progress: number, maxProgress: number) {
  const db = await getDb();
  const existing = await db.select().from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)))
    .limit(1);
  if (existing.length > 0) {
    if (existing[0].earnedAt) return; // Already earned, don't update
    await db.update(userAchievements).set({ progress: Math.min(progress, maxProgress) })
      .where(eq(userAchievements.id, existing[0].id));
  } else {
    await db.insert(userAchievements).values({
      userId, achievementId, progress: Math.min(progress, maxProgress), maxProgress,
    });
  }
}

/** Per-user debounce for achievement checks (30s window) */
const achievementCheckTimestamps = new Map<number, number>();
const ACHIEVEMENT_DEBOUNCE_MS = 30_000;

/** Check and award applicable achievements for a user */
export async function checkAndAwardAchievements(userId: number) {
  const now = Date.now();
  const last = achievementCheckTimestamps.get(userId);
  if (last && now - last < ACHIEVEMENT_DEBOUNCE_MS) return [];
  achievementCheckTimestamps.set(userId, now);

  const db = await getDb();
  const allAchievs = await db.select().from(achievements);
  const userAchievs = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
  const earnedIds = new Set(userAchievs.filter(ua => ua.earnedAt !== null).map(ua => ua.achievementId));

  // Early exit: if all achievements already earned, skip the expensive queries
  const unearnedAchievs = allAchievs.filter(a => !earnedIds.has(a.id) && a.requirementType);
  if (unearnedAchievs.length === 0) return [];

  // Determine which stat types are actually needed by unearned achievements
  const neededStats = new Set(unearnedAchievs.map(a => a.requirementType!));

  // Get user stats
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return [];

  // Only run COUNT queries for stats that are actually needed
  const statQueries: Promise<any>[] = [];
  const statKeys: string[] = [];

  const addQuery = (key: string, query: Promise<any>) => {
    if (neededStats.has(key)) { statKeys.push(key); statQueries.push(query); }
  };

  addQuery("matches", db.select({ count: sql<number>`COUNT(*)` }).from(matches)
    .where(and(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)), eq(matches.isActive, true))).then(r => r[0]?.count ?? 0));
  addQuery("messages_sent", db.select({ count: sql<number>`COUNT(*)` }).from(messages)
    .where(eq(messages.senderId, userId)).then(r => r[0]?.count ?? 0));
  addQuery("games_played", db.select({ count: sql<number>`COUNT(*)` }).from(gameParticipants)
    .where(eq(gameParticipants.userId, userId)).then(r => r[0]?.count ?? 0));
  addQuery("games_created", db.select({ count: sql<number>`COUNT(*)` }).from(games)
    .where(eq(games.organizerId, userId)).then(r => r[0]?.count ?? 0));
  addQuery("groups_joined", db.select({ count: sql<number>`COUNT(*)` }).from(groupMembers)
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.isActive, true))).then(r => r[0]?.count ?? 0));
  addQuery("groups_created", db.select({ count: sql<number>`COUNT(*)` }).from(groups)
    .where(eq(groups.createdBy, userId)).then(r => r[0]?.count ?? 0));
  addQuery("coaching_joined", db.select({ count: sql<number>`COUNT(*)` }).from(coachingParticipants)
    .where(and(eq(coachingParticipants.userId, userId), eq(coachingParticipants.status, "confirmed" as any))).then(r => r[0]?.count ?? 0));
  addQuery("court_reviews", db.select({ count: sql<number>`COUNT(*)` }).from(courtReviews)
    .where(eq(courtReviews.userId, userId)).then(r => r[0]?.count ?? 0));
  addQuery("endorsements_given", db.select({ count: sql<number>`COUNT(*)` }).from(endorsements)
    .where(eq(endorsements.endorserId, userId)).then(r => r[0]?.count ?? 0));
  addQuery("feedback_given", db.select({ count: sql<number>`COUNT(*)` }).from(gameFeedback)
    .where(eq(gameFeedback.reviewerId, userId)).then(r => r[0]?.count ?? 0));
  addQuery("games_won", db.select({ count: sql<number>`COUNT(*)` }).from(gameResults).where(
    or(
      and(eq(gameResults.winnerTeam, "team1"), sql`JSON_CONTAINS(${gameResults.team1PlayerIds}, CAST(${userId} AS JSON))`),
      and(eq(gameResults.winnerTeam, "team2"), sql`JSON_CONTAINS(${gameResults.team2PlayerIds}, CAST(${userId} AS JSON))`)
    )).then(r => r[0]?.count ?? 0));
  addQuery("endorsements_received", db.select({ count: sql<number>`COUNT(*)` }).from(endorsements)
    .where(eq(endorsements.userId, userId)).then(r => r[0]?.count ?? 0));
  addQuery("courts_submitted", db.select({ count: sql<number>`COUNT(*)` }).from(courtSubmissions)
    .where(eq(courtSubmissions.submittedBy, userId)).then(r => r[0]?.count ?? 0));
  addQuery("courts_approved", db.select({ count: sql<number>`COUNT(*)` }).from(courtSubmissions)
    .where(and(eq(courtSubmissions.submittedBy, userId), eq(courtSubmissions.status, "approved"))).then(r => r[0]?.count ?? 0));
  addQuery("tournaments_entered", db.select({ count: sql<number>`COUNT(*)` }).from(tournamentParticipants)
    .where(eq(tournamentParticipants.userId, userId)).then(r => r[0]?.count ?? 0));
  addQuery("tournaments_won", db.select({ count: sql<number>`COUNT(*)` }).from(tournaments)
    .where(and(eq(tournaments.winnerId, userId), eq(tournaments.status, "completed"))).then(r => r[0]?.count ?? 0));
  addQuery("tournaments_organized", db.select({ count: sql<number>`COUNT(*)` }).from(tournaments)
    .where(eq(tournaments.organizerId, userId)).then(r => r[0]?.count ?? 0));

  const results = await Promise.all(statQueries);

  const statsMap: Record<string, number> = {};
  for (let i = 0; i < statKeys.length; i++) {
    statsMap[statKeys[i]] = results[i];
  }
  // Include user-derived stats directly (no DB query needed)
  statsMap["has_photo"] = user.hasProfilePhoto ? 1 : 0;
  statsMap["profile_completion"] = user.profileCompletion ?? 0;
  statsMap["level"] = user.level ?? 1;
  statsMap["xp"] = user.xp ?? 0;
  statsMap["streak"] = user.currentStreak ?? 0;
  statsMap["onboarding_completed"] = user.onboardingCompleted ? 1 : 0;
  const awarded: string[] = [];
  for (const achiev of unearnedAchievs) {
    if (earnedIds.has(achiev.id)) continue;
    const reqType = achiev.requirementType;
    const reqValue = achiev.requirementValue ?? 1;
    if (!reqType) continue;
    const currentValue = statsMap[reqType] ?? 0;
    // Update progress tracking
    await updateAchievementProgress(userId, achiev.id, currentValue, reqValue);
    if (currentValue >= reqValue) {
      const wasAwarded = await awardAchievement(userId, achiev.id);
      if (wasAwarded) awarded.push(achiev.name);
    }
  }
  return awarded;
}

// =============================================================================
// CHALLENGE QUERIES
// =============================================================================

export async function createChallenge(challengerId: number, challengedId: number, data: {
  gameType?: string; format?: string; message?: string;
  courtId?: number; locationName?: string; scheduledAt?: string;
  durationMinutes?: number; skillLevelMin?: string; skillLevelMax?: string;
  maxPlayers?: number; notes?: string;
}) {
  const db = await getDb();

  // Anti-spam: check for existing pending challenge to same player
  const [existingPending] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(and(
      eq(challenges.challengerId, challengerId),
      eq(challenges.challengedId, challengedId),
      eq(challenges.status, "pending")
    ))
    .limit(1);
  if (existingPending) {
    throw new Error("You already have a pending challenge to this player");
  }

  // Anti-spam: rate limit - max 5 challenges per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(challenges)
    .where(and(
      eq(challenges.challengerId, challengerId),
      gte(challenges.createdAt, oneHourAgo)
    ));
  if ((recentCount?.count ?? 0) >= 5) {
    throw new Error("Too many challenges sent recently. Please wait before sending more.");
  }

  const [result] = await db.insert(challenges).values({
    challengerId,
    challengedId,
    gameType: (data.gameType || "casual") as any,
    format: (data.format || "singles") as any,
    message: data.message || null,
    courtId: data.courtId || null,
    locationName: data.locationName || null,
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    durationMinutes: data.durationMinutes || 90,
    skillLevelMin: data.skillLevelMin || null,
    skillLevelMax: data.skillLevelMax || null,
    maxPlayers: data.maxPlayers || (data.format === "singles" ? 2 : 4),
    notes: data.notes || null,
  }).$returningId();

  // Send notification to the challenged player
  const challenger = await db.select({ nickname: users.nickname, name: users.name }).from(users).where(eq(users.id, challengerId)).limit(1);
  const challengerName = challenger[0]?.nickname || challenger[0]?.name || "Someone";
  await createNotification(challengedId, {
    type: "game_invite",
    title: "New Challenge!",
    content: `${challengerName} challenged you to a ${data.gameType || "casual"} ${data.format || "singles"} game`,
    link: "challenges",
  });

  return { id: result.id };
}

export async function getChallengeById(challengeId: number) {
  const db = await getDb();
  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  return challenge || null;
}

export async function respondToChallenge(userId: number, challengeId: number, accept: boolean) {
  const db = await getDb();
  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.challengedId !== userId) throw new Error("Not your challenge to respond to");
  if (challenge.status !== "pending") throw new Error("Challenge already responded to");

  if (accept) {
    return db.transaction(async (tx) => {
      // Create a game for the challenge using the challenge details
      const scheduledAt = challenge.scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
      const [game] = await tx.insert(games).values({
        organizerId: challenge.challengerId,
        courtId: challenge.courtId,
        locationName: challenge.locationName,
        scheduledAt,
        durationMinutes: challenge.durationMinutes || 90,
        gameType: challenge.gameType,
        format: challenge.format,
        maxPlayers: challenge.maxPlayers || (challenge.format === "singles" ? 2 : 4),
        skillLevelMin: challenge.skillLevelMin,
        skillLevelMax: challenge.skillLevelMax,
        status: "scheduled",
        notes: challenge.notes || `Challenge game`,
      }).$returningId();
      // Add both players as confirmed
      await tx.insert(gameParticipants).values([
        { gameId: game.id, userId: challenge.challengerId, status: "confirmed" },
        { gameId: game.id, userId: challenge.challengedId, status: "confirmed" },
      ]);
      await tx.update(challenges).set({ status: "accepted", respondedAt: new Date(), gameId: game.id }).where(eq(challenges.id, challengeId));
      // Notify challenger that challenge was accepted
      const responder = await tx.select({ nickname: users.nickname, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      const responderName = responder[0]?.nickname || responder[0]?.name || "Someone";
      await createNotification(challenge.challengerId, {
        type: "game_invite",
        title: "Challenge Accepted!",
        content: `${responderName} accepted your challenge! Game scheduled.`,
        link: "game-history",
      });
      return { success: true, gameId: game.id };
    });
  } else {
    await db.update(challenges).set({ status: "declined", respondedAt: new Date() }).where(eq(challenges.id, challengeId));
    // Notify challenger that challenge was declined
    const responder = await db.select({ nickname: users.nickname, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    const responderName = responder[0]?.nickname || responder[0]?.name || "Someone";
    await createNotification(challenge.challengerId, {
      type: "game_invite",
      title: "Challenge Declined",
      content: `${responderName} declined your challenge.`,
      link: "challenges",
    });
    return { success: true };
  }
}

export async function getPendingChallengesForUser(userId: number) {
  const db = await getDb();
  const rows = await db.select({
    id: challenges.id,
    challengerId: challenges.challengerId,
    challengedId: challenges.challengedId,
    gameType: challenges.gameType,
    format: challenges.format,
    message: challenges.message,
    status: challenges.status,
    createdAt: challenges.createdAt,
    challengerName: users.name,
    challengerUsername: users.username,
    challengerNickname: users.nickname,
    challengerPhoto: users.profilePhotoUrl,
  }).from(challenges)
    .leftJoin(users, eq(users.id, challenges.challengerId))
    .where(and(
      eq(challenges.challengedId, userId),
      eq(challenges.status, "pending"),
    ))
    .orderBy(desc(challenges.createdAt))
    .limit(50);
  return rows;
}

export async function getSentChallenges(userId: number) {
  const db = await getDb();
  return db.select({
    id: challenges.id,
    challengedId: challenges.challengedId,
    gameType: challenges.gameType,
    format: challenges.format,
    message: challenges.message,
    status: challenges.status,
    createdAt: challenges.createdAt,
    challengedName: users.name,
    challengedUsername: users.username,
  }).from(challenges)
    .leftJoin(users, eq(users.id, challenges.challengedId))
    .where(eq(challenges.challengerId, userId))
    .orderBy(desc(challenges.createdAt))
    .limit(50);
}

export async function getAllPendingForUser(userId: number) {
  const db = await getDb();

  // Pending challenges received
  const pendingChallenges = await getPendingChallengesForUser(userId);

  // Pending game join requests (games I organized, others requested to join)
  const pendingGameReqs = await db.select({
    gameId: gameParticipants.gameId,
    userId: gameParticipants.userId,
    joinedAt: gameParticipants.joinedAt,
    userName: users.name,
    userUsername: users.username,
    gameName: sql<string>`(SELECT locationName FROM games WHERE id = ${gameParticipants.gameId})`,
    gameDate: sql<Date>`(SELECT scheduledAt FROM games WHERE id = ${gameParticipants.gameId})`,
  }).from(gameParticipants)
    .leftJoin(users, eq(users.id, gameParticipants.userId))
    .where(and(
      eq(gameParticipants.status, "pending" as any),
      sql`${gameParticipants.gameId} IN (SELECT id FROM games WHERE organizerId = ${userId})`,
    ))
    .limit(50);

  // Pending coaching join requests (coaching I organized)
  const pendingCoachingReqs = await db.select({
    coachingId: coachingParticipants.coachingId,
    userId: coachingParticipants.userId,
    joinedAt: coachingParticipants.joinedAt,
    userName: users.name,
    userUsername: users.username,
    sessionTitle: sql<string>`(SELECT title FROM shared_coaching WHERE id = ${coachingParticipants.coachingId})`,
  }).from(coachingParticipants)
    .leftJoin(users, eq(users.id, coachingParticipants.userId))
    .where(and(
      eq(coachingParticipants.status, "pending" as any),
      sql`${coachingParticipants.coachingId} IN (SELECT id FROM shared_coaching WHERE organizerId = ${userId})`,
    ))
    .limit(50);

  // Challenges I sent (still pending)
  const sentChallenges = await getSentChallenges(userId);
  const pendingSentChallenges = sentChallenges.filter(c => c.status === "pending");

  // Games I requested to join (still pending)
  const myPendingGameReqs = await db.select({
    gameId: gameParticipants.gameId,
    joinedAt: gameParticipants.joinedAt,
    gameName: sql<string>`(SELECT locationName FROM games WHERE id = ${gameParticipants.gameId})`,
    gameDate: sql<Date>`(SELECT scheduledAt FROM games WHERE id = ${gameParticipants.gameId})`,
  }).from(gameParticipants)
    .where(and(
      eq(gameParticipants.userId, userId),
      eq(gameParticipants.status, "pending" as any),
    ))
    .limit(50);

  // Coaching I requested to join (still pending)
  const myPendingCoachingReqs = await db.select({
    coachingId: coachingParticipants.coachingId,
    joinedAt: coachingParticipants.joinedAt,
    sessionTitle: sql<string>`(SELECT title FROM shared_coaching WHERE id = ${coachingParticipants.coachingId})`,
  }).from(coachingParticipants)
    .where(and(
      eq(coachingParticipants.userId, userId),
      eq(coachingParticipants.status, "pending" as any),
    ))
    .limit(50);

  return {
    challenges: pendingChallenges,
    gameRequests: pendingGameReqs,
    coachingRequests: pendingCoachingReqs,
    sentChallenges: pendingSentChallenges,
    myGameRequests: myPendingGameReqs,
    myCoachingRequests: myPendingCoachingReqs,
  };
}

// =============================================================================
// ENDORSEMENT QUERIES
// =============================================================================

export async function giveEndorsement(endorserId: number, userId: number, type: string) {
  const db = await getDb();
  await db.insert(endorsements).values({ userId, endorserId, endorsementType: type as any });
}

export async function getEndorsementsForUser(userId: number) {
  const db = await getDb();
  return db.select().from(endorsements).where(eq(endorsements.userId, userId)).limit(500);
}

export async function getMyEndorsementsForUser(endorserId: number, userId: number) {
  const db = await getDb();
  return db.select({ type: endorsements.endorsementType }).from(endorsements)
    .where(and(eq(endorsements.endorserId, endorserId), eq(endorsements.userId, userId)));
}

export async function revokeEndorsement(endorserId: number, userId: number, type: string) {
  const db = await getDb();
  await db.delete(endorsements).where(
    and(
      eq(endorsements.userId, userId),
      eq(endorsements.endorserId, endorserId),
      eq(endorsements.endorsementType, type as any),
    )
  );
}

// =============================================================================
// NOTIFICATION QUERIES
// =============================================================================

export async function getUserNotifications(userId: number, limit = 100) {
  const db = await getDb();
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  await db.update(notifications).set({ isRead: true }).where(
    and(eq(notifications.id, notificationId), eq(notifications.userId, userId))
  );
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function deleteAllNotifications(userId: number) {
  const db = await getDb();
  await db.delete(notifications).where(eq(notifications.userId, userId));
}

// Map notification type to preference column
const notifTypeToColumn: Record<string, keyof typeof notificationPreferences.$inferSelect> = {
  match: "matchNotif",
  message: "messageNotif",
  game_invite: "gameInviteNotif",
  tournament_invite: "gameInviteNotif",
  achievement: "achievementNotif",
  system: "systemNotif",
};

export async function createNotification(userId: number, data: {
  type: "match" | "message" | "game_invite" | "achievement" | "system" | "tournament_invite";
  title: string;
  content?: string;
  link?: string;
  targetId?: number;
}) {
  const db = await getDb();

  // Check user preferences
  const prefs = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId)).limit(1);
  if (prefs.length > 0) {
    const col = notifTypeToColumn[data.type];
    if (col && prefs[0][col] === false) return; // User opted out of this type
  }

  await db.insert(notifications).values({
    userId,
    type: data.type,
    title: data.title,
    content: data.content || null,
    link: data.link || null,
    targetId: data.targetId ?? null,
  });
}

export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  const result = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId)).limit(1);
  if (!result.length) {
    // Return defaults
    return {
      matchNotif: true, messageNotif: true, gameInviteNotif: true,
      achievementNotif: true, systemNotif: true, pushEnabled: true, emailEnabled: false,
      showDistance: true, showOnline: true, publicProfile: true,
    };
  }
  return result[0];
}

export async function updateNotificationPreferences(userId: number, prefs: {
  matchNotif?: boolean; messageNotif?: boolean; gameInviteNotif?: boolean;
  achievementNotif?: boolean; systemNotif?: boolean; pushEnabled?: boolean; emailEnabled?: boolean;
  showDistance?: boolean; showOnline?: boolean; publicProfile?: boolean;
}) {
  const db = await getDb();

  const existing = await db.select({ id: notificationPreferences.id }).from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId)).limit(1);

  if (existing.length > 0) {
    await db.update(notificationPreferences).set(prefs as any)
      .where(eq(notificationPreferences.userId, userId));
  } else {
    await db.insert(notificationPreferences).values({ userId, ...prefs } as any);
  }
}

// =============================================================================
// MODERATION QUERIES
// =============================================================================

/** Check if either user has blocked the other */
export async function isBlocked(userId1: number, userId2: number): Promise<boolean> {
  const db = await getDb();
  const [blocked] = await db.select({ id: blocks.id })
    .from(blocks)
    .where(or(
      and(eq(blocks.blockerId, userId1), eq(blocks.blockedId, userId2)),
      and(eq(blocks.blockerId, userId2), eq(blocks.blockedId, userId1)),
    )).limit(1);
  return !!blocked;
}

/** Get all user IDs blocked by or blocking a given user */
export async function getBlockedUserIds(userId: number): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db.select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
  const ids = new Set<number>();
  for (const r of rows) {
    ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  }
  return ids;
}

export async function createReport(reporterId: number, data: { reportedId: number; reportType: string; description?: string }) {
  const db = await getDb();
  await db.insert(reports).values({
    reporterId,
    reportedId: data.reportedId,
    reportType: data.reportType as any,
    description: data.description,
  });
}

export async function blockUser(blockerId: number, blockedId: number, reason?: string) {
  const db = await getDb();
  await db.insert(blocks).values({ blockerId, blockedId, reason });
}

export async function unblockUser(blockerId: number, blockedId: number) {
  const db = await getDb();
  await db.delete(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
}

export async function getBlockedUsers(userId: number) {
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      profilePhotoUrl: users.profilePhotoUrl,
      blockedAt: blocks.blockedAt,
    })
    .from(blocks)
    .innerJoin(users, eq(blocks.blockedId, users.id))
    .where(eq(blocks.blockerId, userId))
    .orderBy(desc(blocks.blockedAt));
  return rows;
}

export async function changePassword(userId: number, newPasswordHash: string) {
  const db = await getDb();
  await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));
}

export async function softDeleteUser(userId: number) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Soft-delete the user and scrub PII
    await tx.update(users).set({
      isDeleted: true,
      deletedAt: new Date(),
      email: sql`CONCAT('deleted_', id, '_', email)`,
      name: "Deleted User",
      nickname: null,
      bio: null,
      profilePhotoUrl: null,
      hasProfilePhoto: false,
      latitude: null,
      longitude: null,
      city: null,
      isActive: false,
    } as any).where(eq(users.id, userId));
    // Remove photos
    await tx.delete(userPhotos).where(eq(userPhotos.userId, userId));
    // Remove push subscriptions
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    // Leave all conversations
    await tx.update(conversationParticipants).set({ leftAt: new Date() } as any)
      .where(and(eq(conversationParticipants.userId, userId), isNull(conversationParticipants.leftAt)));
    // Deactivate matches
    await tx.update(matches).set({ isActive: false } as any)
      .where(and(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)), eq(matches.isActive, true)));
    // Remove swipes (they contain preference data)
    await tx.delete(swipes).where(or(eq(swipes.swiperId, userId), eq(swipes.swipedId, userId)));
  });
}

export async function exportUserData(userId: number) {
  const db = await getDb();
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows[0]) return null;
  const { passwordHash, ...userData } = userRows[0] as any;
  const userMatches = await db.select().from(matches).where(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)));
  const userGameParts = await db.select().from(gameParticipants).where(eq(gameParticipants.userId, userId));
  const userAchvs = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
  return { user: userData, matches: userMatches, games: userGameParts, achievements: userAchvs, exportedAt: new Date().toISOString() };
}

// =============================================================================
// ADMIN QUERIES
// =============================================================================

export async function getAdminStats() {
  const db = await getDb();
  const [userStats] = await db.select({
    totalUsers: sql<number>`COUNT(*)`,
    activeUsers: sql<number>`SUM(CASE WHEN ${users.isActive} = true THEN 1 ELSE 0 END)`,
  }).from(users).where(eq(users.isDeleted, false));
  const [matchStats] = await db.select({ totalMatches: sql<number>`COUNT(*)` }).from(matches);
  const [reportStats] = await db.select({ pendingReports: sql<number>`COUNT(*)` }).from(reports).where(eq(reports.status, "pending"));
  const [activeTodayStats] = await db.select({
    activeToday: sql<number>`COUNT(*)`,
  }).from(users).where(
    and(
      eq(users.isDeleted, false),
      eq(users.isActive, true),
      sql`${users.lastSignedIn} >= CURDATE()`
    )
  );

  // Premium user count
  const [premiumStats] = await db.select({
    premiumUsers: sql<number>`SUM(CASE WHEN ${users.isPremium} = true THEN 1 ELSE 0 END)`,
  }).from(users).where(eq(users.isDeleted, false));

  // Weekly activity: count of user sign-ins per day for the last 7 days
  const weeklyRows = await db.select({
    day: sql<string>`DATE(${users.lastSignedIn})`.as("day"),
    count: sql<number>`COUNT(*)`.as("count"),
  }).from(users).where(
    and(
      eq(users.isDeleted, false),
      sql`${users.lastSignedIn} >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`
    )
  ).groupBy(sql`DATE(${users.lastSignedIn})`).orderBy(sql`DATE(${users.lastSignedIn})`);

  // Fill in missing days with 0
  const weeklyActivity: { day: string; count: number }[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = dayNames[d.getDay()];
    const row = weeklyRows.find((r: any) => String(r.day) === dateStr);
    weeklyActivity.push({ day: dayLabel, count: row?.count ?? 0 });
  }

  return {
    totalUsers: userStats?.totalUsers ?? 0,
    activeUsers: userStats?.activeUsers ?? 0,
    activeToday: activeTodayStats?.activeToday ?? 0,
    totalMatches: matchStats?.totalMatches ?? 0,
    pendingReports: reportStats?.pendingReports ?? 0,
    premiumUsers: premiumStats?.premiumUsers ?? 0,
    conversionRate: userStats?.totalUsers ? Math.round(((premiumStats?.premiumUsers ?? 0) / userStats.totalUsers) * 100) : 0,
    weeklyActivity,
  };
}

export async function getAdminReports(status?: string, page = 1, limit = 50) {
  const db = await getDb();
  const conditions: any[] = [];
  if (status) conditions.push(eq(reports.status, status as any));
  return db.select().from(reports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

export async function resolveReport(adminId: number, reportId: number, status: string) {
  const db = await getDb();
  await db.update(reports).set({ status: status as any, reviewedBy: adminId, reviewedAt: new Date() }).where(eq(reports.id, reportId));
}

export async function getAdminUsers(search?: string, page?: number, limit?: number) {
  const db = await getDb();
  const p = page ?? 1;
  const l = limit ?? 20;
  const conditions: any[] = [eq(users.isDeleted, false)];
  if (search) {
    const escaped = search.replace(/[%_\\]/g, '\\$&');
    conditions.push(or(like(users.name, `%${escaped}%`), like(users.email, `%${escaped}%`)));
  }
  return db.select().from(users).where(and(...conditions)).limit(l).offset((p - 1) * l).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "superadmin") {
  const db = await getDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function suspendUser(userId: number) {
  const db = await getDb();
  await db.update(users).set({ isActive: false }).where(eq(users.id, userId));
}

export async function unsuspendUser(userId: number) {
  const db = await getDb();
  await db.update(users).set({ isActive: true }).where(eq(users.id, userId));
}

export async function getAppSettings() {
  const db = await getDb();
  return db.select().from(appSettings);
}

export async function updateAppSetting(adminId: number, key: string, value: string) {
  const db = await getDb();
  await db.insert(appSettings).values({ key, value, updatedBy: adminId })
    .onDuplicateKeyUpdate({ set: { value, updatedBy: adminId } });
}

// =============================================================================
// EMAIL VERIFICATION CODES
// =============================================================================

export async function createEmailVerificationCode(userId: number, code: string) {
  const db = await getDb();
  // Delete any existing codes for this user first
  await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, userId));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await db.insert(emailVerificationCodes).values({ userId, code, expiresAt });
}

export async function verifyEmailCode(userId: number, code: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select().from(emailVerificationCodes)
    .where(and(
      eq(emailVerificationCodes.userId, userId),
      eq(emailVerificationCodes.code, code),
      isNull(emailVerificationCodes.usedAt),
    )).limit(1);
  if (!row) return false;
  if (new Date() > row.expiresAt) return false;
  // Mark as used
  await db.update(emailVerificationCodes).set({ usedAt: new Date() }).where(eq(emailVerificationCodes.id, row.id));
  return true;
}

// =============================================================================
// AUTH QUERIES
// =============================================================================

export async function getUserByEmail(email: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function authenticateUser(email: string, password: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(
    and(eq(users.email, email), eq(users.isDeleted, false))
  ).limit(1);
  if (result.length === 0) return undefined;
  const user = result[0];
  if (!user.passwordHash) return undefined;
  // Use timing-safe comparison via crypto
  const { timingSafeEqual, scryptSync } = await import("crypto");
  const [salt, hash] = user.passwordHash.split(":");
  if (!salt || !hash) return undefined;
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const derivedBuf = Buffer.from(derivedKey, "hex");
    if (hashBuf.length !== derivedBuf.length) return undefined;
    if (!timingSafeEqual(hashBuf, derivedBuf)) return undefined;
  } catch {
    return undefined;
  }
  return user;
}

export async function createUserWithPassword(data: { email: string; username: string; password: string; name?: string }) {
  const db = await getDb();
  const openId = `email-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Hash password with scrypt (Node.js native crypto)
  const { randomBytes, scryptSync } = await import("crypto");
  const salt = randomBytes(32).toString("hex");
  const derivedKey = scryptSync(data.password, salt, 64).toString("hex");
  const hashedPassword = `${salt}:${derivedKey}`;

  await db.insert(users).values({
    openId,
    email: data.email,
    username: data.username,
    name: data.name ?? data.username,
    passwordHash: hashedPassword,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  return getUserByEmail(data.email);
}

// =============================================================================
// GROUP QUERIES
// =============================================================================

export async function getGroups(city?: string, groupType?: string) {
  const db = await getDb();
  const conditions: any[] = [];
  if (city) conditions.push(like(groups.locationCity, `%${city}%`));
  if (groupType) conditions.push(eq(groups.groupType, groupType as any));
  const results = conditions.length > 0
    ? await db.select().from(groups).where(and(...conditions)).orderBy(desc(groups.createdAt))
    : await db.select().from(groups).orderBy(desc(groups.createdAt));
  return results;
}

export async function getUserGroups(userId: number) {
  const db = await getDb();
  const results = await db
    .select({ group: groups })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.isActive, true), eq(groupMembers.status, "active")))
    .orderBy(desc(groups.createdAt));
  return results.map(r => r.group);
}

export async function getGroupById(groupId: number) {
  const db = await getDb();
  const result = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createGroup(userId: number, data: {
  name: string; description?: string; groupType?: string; isPrivate?: boolean; locationCity?: string;
}) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Create a group conversation
    const [convInserted] = await tx.insert(conversations).values({
      type: "group",
      name: data.name,
      createdBy: userId,
    }).$returningId();
    const conversationId = convInserted.id;
    // Add creator as conversation participant
    await tx.insert(conversationParticipants).values({ conversationId, userId, isAdmin: true });
    // Create the group with conversation link
    const [inserted] = await tx.insert(groups).values({
      name: data.name,
      description: data.description,
      groupType: (data.groupType ?? "social") as any,
      isPrivate: data.isPrivate ?? false,
      createdBy: userId,
      memberCount: 1,
      locationCity: data.locationCity,
      conversationId,
    });
    const groupId = inserted.insertId;
    await tx.insert(groupMembers).values({ groupId, userId, role: "admin" });
    return { groupId, conversationId };
  });
}

export async function joinGroup(userId: number, groupId: number) {
  const db = await getDb();
  return await db.transaction(async (tx) => {
    // Lock the group row to protect memberCount
    const lockResult = await tx.execute(sql`SELECT id, isPrivate, conversationId, name FROM \`groups\` WHERE id = ${groupId} FOR UPDATE`);
    const group = (lockResult as any)[0]?.[0];
    if (!group) throw new Error("Group not found");
    const isPublic = !group.isPrivate;

    // Check for existing membership (active or inactive)
    const existing = await tx.select().from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);
    if (existing.length > 0) {
      if (existing[0].isActive && existing[0].status === "active") return { status: "already-member" as const };
      if (existing[0].status === "pending") return { status: "already-pending" as const };
      // Re-activate deactivated membership
      const newStatus = isPublic ? "active" : "pending";
      await tx.update(groupMembers).set({ isActive: true, status: newStatus }).where(eq(groupMembers.id, existing[0].id));
    } else {
      const newStatus = isPublic ? "active" : "pending";
      await tx.insert(groupMembers).values({ groupId, userId, role: "member", status: newStatus });
    }

    if (isPublic) {
      // Public group: auto-approve — atomic increment
      await tx.update(groups).set({ memberCount: sql`${groups.memberCount} + 1` }).where(eq(groups.id, groupId));
      if (group.conversationId) {
        const existingConvo = await tx.select().from(conversationParticipants)
          .where(and(eq(conversationParticipants.conversationId, group.conversationId), eq(conversationParticipants.userId, userId)))
          .limit(1);
        if (existingConvo.length === 0) {
          await tx.insert(conversationParticipants).values({ conversationId: group.conversationId, userId });
        } else if (existingConvo[0].leftAt) {
          await tx.update(conversationParticipants).set({ leftAt: null }).where(eq(conversationParticipants.id, existingConvo[0].id));
        }
      }
      return { status: "active" as const };
    }

    return { status: "pending" as const, groupName: group.name };
  });
}

/** Approve a pending group member request (admin only) */
export async function approveGroupMember(adminUserId: number, groupId: number, userId: number) {
  const db = await getDb();
  // Verify admin
  const [admin] = await db.select().from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, adminUserId), eq(groupMembers.role, "admin"), eq(groupMembers.isActive, true)))
    .limit(1);
  if (!admin) throw new Error("Only group admins can approve members");

  await db.transaction(async (tx) => {
    const [member] = await tx.select().from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.status, "pending")))
      .limit(1);
    if (!member) throw new Error("No pending request found");
    await tx.update(groupMembers).set({ status: "active" }).where(eq(groupMembers.id, member.id));
    await tx.update(groups).set({ memberCount: sql`${groups.memberCount} + 1` }).where(eq(groups.id, groupId));
    // Add to group conversation
    const group = await tx.select({ conversationId: groups.conversationId, name: groups.name }).from(groups).where(eq(groups.id, groupId)).limit(1);
    if (group[0]?.conversationId) {
      const existingConvo = await tx.select().from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, group[0].conversationId), eq(conversationParticipants.userId, userId)))
        .limit(1);
      if (existingConvo.length === 0) {
        await tx.insert(conversationParticipants).values({ conversationId: group[0].conversationId, userId });
      } else if (existingConvo[0].leftAt) {
        await tx.update(conversationParticipants).set({ leftAt: null }).where(eq(conversationParticipants.id, existingConvo[0].id));
      }
    }
  });
  // Notify the approved user (after successful transaction)
  const group = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId)).limit(1);
  await createNotification(userId, {
    type: "system",
    title: "Group Request Approved!",
    content: `You've been accepted into ${group[0]?.name || "the group"}`,
    link: "groups",
  });
}

/** Decline a pending group member request (admin only) */
export async function declineGroupMember(adminUserId: number, groupId: number, userId: number) {
  const db = await getDb();
  const [admin] = await db.select().from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, adminUserId), eq(groupMembers.role, "admin"), eq(groupMembers.isActive, true)))
    .limit(1);
  if (!admin) throw new Error("Only group admins can decline members");
  await db.delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.status, "pending")));
}

export async function leaveGroup(userId: number, groupId: number) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Lock membership row to prevent race condition on memberCount
    const membership = await tx.select().from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.isActive, true)))
      .for("update")
      .limit(1);
    if (!membership.length) throw new Error("User is not an active member of this group");
    await tx.update(groupMembers).set({ isActive: false }).where(eq(groupMembers.id, membership[0].id));
    await tx.update(groups).set({ memberCount: sql`GREATEST(${groups.memberCount} - 1, 0)` }).where(eq(groups.id, groupId));
    // Also remove from group conversation
    const group = await tx.select({ conversationId: groups.conversationId }).from(groups).where(eq(groups.id, groupId)).limit(1);
    if (group[0]?.conversationId) {
      await tx.update(conversationParticipants).set({ leftAt: new Date() })
        .where(and(eq(conversationParticipants.conversationId, group[0].conversationId), eq(conversationParticipants.userId, userId)));
    }
  });
}

export async function getGroupMembers(groupId: number) {
  const db = await getDb();
  return db.select({
    memberId: groupMembers.id,
    userId: groupMembers.userId,
    role: groupMembers.role,
    status: groupMembers.status,
    joinedAt: groupMembers.joinedAt,
    name: users.name,
    nickname: users.nickname,
    profilePhotoUrl: users.profilePhotoUrl,
    hasProfilePhoto: users.hasProfilePhoto,
  }).from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.isActive, true)));
}

export async function getGroupAdmins(groupId: number) {
  const db = await getDb();
  return db.select({ userId: groupMembers.userId }).from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "admin"), eq(groupMembers.isActive, true)));
}

export async function getGroupLeaderboard(groupId: number) {
  const db = await getDb();
  const memberRows = await db.select({
    userId: groupMembers.userId,
    name: users.name,
    nickname: users.nickname,
    profilePhotoUrl: users.profilePhotoUrl,
    hasProfilePhoto: users.hasProfilePhoto,
    xp: users.xp,
    level: users.level,
    currentStreak: users.currentStreak,
  }).from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.isActive, true)))
    .orderBy(desc(users.xp));

  if (memberRows.length === 0) return [];

  // Batch compute games played for all members
  const userIds = memberRows.map(m => m.userId);
  const gamesPlayedRows = await db.select({
    userId: gameParticipants.userId,
    count: sql<number>`COUNT(*)`,
  }).from(gameParticipants)
    .where(sql`${gameParticipants.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(gameParticipants.userId);
  const gamesPlayedMap = new Map(gamesPlayedRows.map(r => [r.userId, r.count]));

  return memberRows.map(m => ({
    ...m,
    gamesPlayed: gamesPlayedMap.get(m.userId) ?? 0,
  }));
}

// =============================================================================
// COACHING SESSION QUERIES
// =============================================================================

export async function getCoachingSessionById(coachingId: number) {
  const db = await getDb();
  const [session] = await db.select().from(sharedCoaching).where(eq(sharedCoaching.id, coachingId)).limit(1);
  return session ?? null;
}

export async function getCoachingSessions(status?: string) {
  const db = await getDb();
  const conditions: any[] = [];
  if (status) conditions.push(eq(sharedCoaching.status, status as any));
  const sessions = conditions.length > 0
    ? await db.select().from(sharedCoaching).where(and(...conditions)).orderBy(desc(sharedCoaching.scheduledAt))
    : await db.select().from(sharedCoaching).orderBy(desc(sharedCoaching.scheduledAt));
  if (sessions.length === 0) return sessions;
  // Batch-fetch participant counts instead of N+1 per-session queries
  const sessionIds = sessions.map(s => s.id);
  const counts = await db.select({
    coachingId: coachingParticipants.coachingId,
    count: sql<number>`COUNT(*)`,
  }).from(coachingParticipants)
    .where(and(
      sql`${coachingParticipants.coachingId} IN (${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)})`,
      eq(coachingParticipants.status, "confirmed"),
    ))
    .groupBy(coachingParticipants.coachingId);
  const countMap = new Map(counts.map(c => [c.coachingId, c.count]));
  return sessions.map(s => ({ ...s, participantCount: countMap.get(s.id) ?? 0 }));
}

export async function createCoachingSession(userId: number, data: {
  title: string; description?: string; coachName?: string; location?: string;
  scheduledAt: string; durationMinutes?: number; maxParticipants?: number;
  costPerPerson?: number; skillLevel?: string; isVirtual?: boolean;
}) {
  const db = await getDb();
  return await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(sharedCoaching).values({
      organizerId: userId,
      title: data.title,
      description: data.description,
      coachName: data.coachName,
      location: data.isVirtual ? "Virtual" : data.location,
      scheduledAt: new Date(data.scheduledAt),
      durationMinutes: data.durationMinutes ?? 60,
      maxParticipants: data.maxParticipants ?? 10,
      costPerPerson: data.costPerPerson,
      skillLevel: data.skillLevel,
      isVirtual: data.isVirtual ?? false,
    });
    const coachingId = inserted.insertId;
    await tx.insert(coachingParticipants).values({ coachingId, userId, status: "confirmed" });
    return { coachingId };
  });
}

export async function joinCoachingSession(userId: number, coachingId: number) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Lock session row to check capacity atomically
    const [session] = await tx.select().from(sharedCoaching)
      .where(eq(sharedCoaching.id, coachingId)).for("update").limit(1);
    if (!session) throw new Error("Coaching session not found");
    if (session.status === "cancelled") throw new Error("Session has been cancelled");
    if (session.status === "completed") throw new Error("Session has already completed");
    if (session.organizerId === userId) throw new Error("Organizer is already a participant");

    // Prevent duplicate joins
    const existing = await tx.select().from(coachingParticipants)
      .where(and(eq(coachingParticipants.coachingId, coachingId), eq(coachingParticipants.userId, userId)))
      .limit(1);
    if (existing.length > 0) {
      if (existing[0].status === "cancelled") {
        await tx.update(coachingParticipants).set({ status: "pending" as any })
          .where(eq(coachingParticipants.id, existing[0].id));
      }
      return;
    }

    // Check capacity
    const [countResult] = await tx.select({ count: sql<number>`COUNT(*)` })
      .from(coachingParticipants)
      .where(and(eq(coachingParticipants.coachingId, coachingId), ne(coachingParticipants.status, "cancelled" as any)));
    if (countResult.count >= session.maxParticipants) throw new Error("Session is full");

    await tx.insert(coachingParticipants).values({ coachingId, userId, status: "pending" });
  });

  // Notify the coaching session organizer (after successful transaction)
  try {
    const [session] = await db.select({ organizerId: sharedCoaching.organizerId, title: sharedCoaching.title }).from(sharedCoaching).where(eq(sharedCoaching.id, coachingId)).limit(1);
    if (session) {
      const requester = await db.select({ nickname: users.nickname, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      const requesterName = requester[0]?.nickname || requester[0]?.name || "Someone";
      await createNotification(session.organizerId, {
        type: "game_invite",
        title: "Coaching Request",
        content: `${requesterName} wants to join "${session.title}"`,
        link: "coaching",
      });
    }
  } catch (e) {
    console.error("Failed to send coaching join notification:", e);
  }
}

/** Approve a pending coaching participant (organizer only) */
export async function approveCoachingParticipant(organizerId: number, coachingId: number, userId: number) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [session] = await tx.select().from(sharedCoaching).where(eq(sharedCoaching.id, coachingId)).for("update").limit(1);
    if (!session || session.organizerId !== organizerId) throw new Error("Only the organizer can approve participants");
    // Check capacity before approving
    const [countResult] = await tx.select({ count: sql<number>`COUNT(*)` })
      .from(coachingParticipants)
      .where(and(eq(coachingParticipants.coachingId, coachingId), eq(coachingParticipants.status, "confirmed" as any)));
    if (countResult.count >= session.maxParticipants) throw new Error("Session is at maximum capacity");
    const [participant] = await tx.select().from(coachingParticipants)
      .where(and(eq(coachingParticipants.coachingId, coachingId), eq(coachingParticipants.userId, userId)))
      .limit(1);
    if (!participant) throw new Error("Participant not found");
    if (participant.status !== "pending") throw new Error("Participant is not pending");
    await tx.update(coachingParticipants).set({ status: "confirmed" as any }).where(eq(coachingParticipants.id, participant.id));
    // Notify the approved participant
    await createNotification(userId, {
      type: "game_invite",
      title: "Coaching Request Approved!",
      content: `You've been accepted into "${session.title}"`,
      link: "coaching",
    });
  });
}

/** Decline a pending coaching participant (organizer only) */
export async function declineCoachingParticipant(organizerId: number, coachingId: number, userId: number) {
  const db = await getDb();
  const [session] = await db.select().from(sharedCoaching).where(eq(sharedCoaching.id, coachingId)).limit(1);
  if (!session || session.organizerId !== organizerId) throw new Error("Only the organizer can decline participants");
  await db.update(coachingParticipants).set({ status: "cancelled" as any })
    .where(and(eq(coachingParticipants.coachingId, coachingId), eq(coachingParticipants.userId, userId)));
}

export async function leaveCoachingSession(userId: number, coachingId: number) {
  const db = await getDb();
  // Verify user is a participant and not the organizer
  const [session] = await db.select({ organizerId: sharedCoaching.organizerId }).from(sharedCoaching)
    .where(eq(sharedCoaching.id, coachingId)).limit(1);
  if (!session) throw new Error("Coaching session not found");
  if (session.organizerId === userId) throw new Error("Organizer cannot leave their own session — cancel it instead");
  const [participant] = await db.select({ id: coachingParticipants.id, status: coachingParticipants.status })
    .from(coachingParticipants)
    .where(and(eq(coachingParticipants.coachingId, coachingId), eq(coachingParticipants.userId, userId)))
    .limit(1);
  if (!participant || participant.status === "cancelled") throw new Error("Not a participant in this session");
  await db.update(coachingParticipants).set({ status: "cancelled" as any })
    .where(eq(coachingParticipants.id, participant.id));
}

export async function addCoachingReview(userId: number, coachingId: number, data: { rating: number; comment?: string }) {
  const db = await getDb();
  // Verify user was a confirmed participant
  const participation = await db.select().from(coachingParticipants)
    .where(and(eq(coachingParticipants.coachingId, coachingId), eq(coachingParticipants.userId, userId), eq(coachingParticipants.status, "confirmed" as any)))
    .limit(1);
  if (!participation.length) throw Object.assign(new Error("You must be a participant to review this session"), { code: "FORBIDDEN" });
  // Prevent duplicate reviews
  const existing = await db.select({ id: coachingReviews.id }).from(coachingReviews)
    .where(and(eq(coachingReviews.coachingId, coachingId), eq(coachingReviews.userId, userId))).limit(1);
  if (existing.length > 0) throw Object.assign(new Error("You have already reviewed this session"), { code: "DUPLICATE" });
  await db.insert(coachingReviews).values({
    coachingId,
    userId,
    rating: data.rating,
    comment: data.comment,
  });
}

export async function getCoachingReviews(coachingId: number) {
  const db = await getDb();
  return db.select({
    id: coachingReviews.id,
    rating: coachingReviews.rating,
    comment: coachingReviews.comment,
    createdAt: coachingReviews.createdAt,
    userName: users.name,
    userNickname: users.nickname,
    userPhoto: users.profilePhotoUrl,
  }).from(coachingReviews)
    .leftJoin(users, eq(coachingReviews.userId, users.id))
    .where(eq(coachingReviews.coachingId, coachingId))
    .orderBy(desc(coachingReviews.createdAt));
}

export async function createCoachingAnnouncement(senderId: number, coachingId: number, content: string) {
  const db = await getDb();
  // Verify sender is the organizer
  const [session] = await db.select({ organizerId: sharedCoaching.organizerId }).from(sharedCoaching)
    .where(eq(sharedCoaching.id, coachingId)).limit(1);
  if (!session || session.organizerId !== senderId) throw new Error("Only the coach can post announcements");
  await db.insert(coachingAnnouncements).values({ coachingId, senderId, content });
  return { success: true };
}

export async function getCoachingAnnouncements(coachingId: number) {
  const db = await getDb();
  return db.select({
    id: coachingAnnouncements.id,
    content: coachingAnnouncements.content,
    createdAt: coachingAnnouncements.createdAt,
    senderName: users.name,
    senderNickname: users.nickname,
    senderPhoto: users.profilePhotoUrl,
  }).from(coachingAnnouncements)
    .leftJoin(users, eq(coachingAnnouncements.senderId, users.id))
    .where(eq(coachingAnnouncements.coachingId, coachingId))
    .orderBy(desc(coachingAnnouncements.createdAt));
}

export async function markCoachingAttendance(organizerId: number, coachingId: number, userId: number, attended: boolean) {
  const db = await getDb();
  // Verify caller is the session organizer
  const [session] = await db.select({ organizerId: sharedCoaching.organizerId }).from(sharedCoaching)
    .where(eq(sharedCoaching.id, coachingId)).limit(1);
  if (!session || session.organizerId !== organizerId) throw new Error("Only the organizer can mark attendance");
  const result = await db.update(coachingParticipants).set({ attended }).where(
    and(eq(coachingParticipants.coachingId, coachingId), eq(coachingParticipants.userId, userId))
  );
  return result;
}

export async function getCoachingParticipants(coachingId: number) {
  const db = await getDb();
  return db.select({
    userId: coachingParticipants.userId,
    status: coachingParticipants.status,
    attended: coachingParticipants.attended,
    name: users.name,
    nickname: users.nickname,
    profilePhotoUrl: users.profilePhotoUrl,
  }).from(coachingParticipants)
    .leftJoin(users, eq(coachingParticipants.userId, users.id))
    .where(eq(coachingParticipants.coachingId, coachingId));
}

export async function updateCoachingSession(userId: number, coachingId: number, data: {
  title?: string; description?: string; coachName?: string; location?: string;
  scheduledAt?: string; durationMinutes?: number; maxParticipants?: number;
  costPerPerson?: number; skillLevel?: string; agenda?: string; focusAreas?: string;
  drillPlan?: string; sessionNotes?: string; equipmentNeeded?: string;
}) {
  const db = await getDb();
  // Verify ownership
  const session = await db.select().from(sharedCoaching).where(eq(sharedCoaching.id, coachingId)).limit(1);
  if (!session.length) throw Object.assign(new Error("Coaching session not found"), { code: "NOT_FOUND" });
  if (session[0].organizerId !== userId) throw Object.assign(new Error("Only the organizer can edit this session"), { code: "FORBIDDEN" });
  const updateObj: any = {};
  if (data.title !== undefined) updateObj.title = data.title;
  if (data.description !== undefined) updateObj.description = data.description;
  if (data.coachName !== undefined) updateObj.coachName = data.coachName;
  if (data.location !== undefined) updateObj.location = data.location;
  if (data.scheduledAt !== undefined) updateObj.scheduledAt = new Date(data.scheduledAt);
  if (data.durationMinutes !== undefined) updateObj.durationMinutes = data.durationMinutes;
  if (data.maxParticipants !== undefined) updateObj.maxParticipants = data.maxParticipants;
  if (data.costPerPerson !== undefined) updateObj.costPerPerson = data.costPerPerson;
  if (data.skillLevel !== undefined) updateObj.skillLevel = data.skillLevel;
  if (data.agenda !== undefined) updateObj.agenda = data.agenda;
  if (data.focusAreas !== undefined) updateObj.focusAreas = data.focusAreas;
  if (data.drillPlan !== undefined) updateObj.drillPlan = data.drillPlan;
  if (data.sessionNotes !== undefined) updateObj.sessionNotes = data.sessionNotes;
  if (data.equipmentNeeded !== undefined) updateObj.equipmentNeeded = data.equipmentNeeded;
  if (Object.keys(updateObj).length > 0) {
    await db.update(sharedCoaching).set(updateObj).where(eq(sharedCoaching.id, coachingId));
  }
}

export async function cancelCoachingSession(userId: number, coachingId: number) {
  const db = await getDb();
  const session = await db.select().from(sharedCoaching).where(eq(sharedCoaching.id, coachingId)).limit(1);
  if (!session.length) throw Object.assign(new Error("Coaching session not found"), { code: "NOT_FOUND" });
  if (session[0].organizerId !== userId) throw Object.assign(new Error("Only the organizer can cancel this session"), { code: "FORBIDDEN" });
  await db.update(sharedCoaching).set({ status: "cancelled" as any }).where(eq(sharedCoaching.id, coachingId));
}

export async function completeCoachingSession(userId: number, coachingId: number) {
  const db = await getDb();
  const session = await db.select().from(sharedCoaching).where(eq(sharedCoaching.id, coachingId)).limit(1);
  if (!session.length) throw Object.assign(new Error("Coaching session not found"), { code: "NOT_FOUND" });
  if (session[0].organizerId !== userId) throw Object.assign(new Error("Only the organizer can complete this session"), { code: "FORBIDDEN" });
  await db.update(sharedCoaching).set({ status: "completed" as any }).where(eq(sharedCoaching.id, coachingId));
}

export async function getMyCoachingSessions(userId: number) {
  const db = await getDb();
  // Sessions I organized
  const coaching = await db.select().from(sharedCoaching)
    .where(eq(sharedCoaching.organizerId, userId))
    .orderBy(desc(sharedCoaching.scheduledAt));
  // Sessions I joined (but didn't organize)
  const enrolledRows = await db.select({ coachingId: coachingParticipants.coachingId })
    .from(coachingParticipants)
    .where(and(eq(coachingParticipants.userId, userId), eq(coachingParticipants.status, "confirmed")));
  const enrolledIds = enrolledRows.map(r => r.coachingId).filter(id => !coaching.some(c => c.id === id));
  let enrolled: any[] = [];
  if (enrolledIds.length > 0) {
    enrolled = await db.select().from(sharedCoaching)
      .where(or(...enrolledIds.map(id => eq(sharedCoaching.id, id))))
      .orderBy(desc(sharedCoaching.scheduledAt));
  }
  // Batch participant counts for all sessions at once
  const allSessionIds = [...coaching.map(s => s.id), ...enrolled.map(s => s.id)];
  const countMap = new Map<number, number>();
  if (allSessionIds.length > 0) {
    const countRows = await db.select({
      coachingId: coachingParticipants.coachingId,
      count: sql<number>`COUNT(*)`,
    }).from(coachingParticipants)
      .where(and(
        sql`${coachingParticipants.coachingId} IN (${sql.join(allSessionIds.map(id => sql`${id}`), sql`, `)})`,
        eq(coachingParticipants.status, "confirmed"),
      ))
      .groupBy(coachingParticipants.coachingId);
    for (const row of countRows) {
      countMap.set(row.coachingId, row.count);
    }
  }
  for (const s of coaching) (s as any).participantCount = countMap.get(s.id) ?? 0;
  for (const s of enrolled) (s as any).participantCount = countMap.get(s.id) ?? 0;
  return { coaching, enrolled };
}

export async function updateGroupMemberRole(adminUserId: number, groupId: number, targetUserId: number, newRole: "admin" | "moderator" | "member") {
  const db = await getDb();
  // Prevent self-role changes
  if (adminUserId === targetUserId) throw new Error("Cannot change your own role");
  // Verify the requester is an admin
  const adminMember = await db.select().from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, adminUserId), eq(groupMembers.isActive, true)))
    .limit(1);
  if (!adminMember.length || adminMember[0].role !== "admin") throw new Error("Only group admins can change roles");
  // Verify target is an active member
  const targetMember = await db.select({ id: groupMembers.id, role: groupMembers.role }).from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId), eq(groupMembers.isActive, true)))
    .limit(1);
  if (!targetMember.length) throw new Error("Target user is not an active member of this group");
  await db.update(groupMembers).set({ role: newRole as any })
    .where(eq(groupMembers.id, targetMember[0].id));
}

export async function removeGroupMember(adminUserId: number, groupId: number, targetUserId: number) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const adminMember = await tx.select().from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, adminUserId), eq(groupMembers.isActive, true)))
      .limit(1);
    if (!adminMember.length || (adminMember[0].role !== "admin" && adminMember[0].role !== "moderator")) throw new Error("Only admins/mods can remove members");
    // Verify target is actually active before decrementing
    const target = await tx.select({ id: groupMembers.id }).from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId), eq(groupMembers.isActive, true)))
      .for("update")
      .limit(1);
    if (!target.length) throw new Error("User is not an active member");
    // Prevent removing another admin unless you are admin
    const targetMember = await tx.select({ role: groupMembers.role }).from(groupMembers)
      .where(eq(groupMembers.id, target[0].id)).limit(1);
    if (targetMember[0]?.role === "admin" && adminMember[0].role !== "admin") throw new Error("Only admins can remove other admins");
    await tx.update(groupMembers).set({ isActive: false })
      .where(eq(groupMembers.id, target[0].id));
    await tx.update(groups).set({ memberCount: sql`GREATEST(${groups.memberCount} - 1, 0)` }).where(eq(groups.id, groupId));
    // Remove from group conversation
    const group = await tx.select({ conversationId: groups.conversationId }).from(groups).where(eq(groups.id, groupId)).limit(1);
    if (group[0]?.conversationId) {
      await tx.update(conversationParticipants).set({ leftAt: new Date() })
        .where(and(eq(conversationParticipants.conversationId, group[0].conversationId), eq(conversationParticipants.userId, targetUserId)));
    }
  });
}

export async function updateGroup(adminUserId: number, groupId: number, data: {
  name?: string; description?: string; locationCity?: string; photo?: string;
}) {
  const db = await getDb();
  const adminMember = await db.select().from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, adminUserId), eq(groupMembers.isActive, true)))
    .limit(1);
  if (!adminMember.length || adminMember[0].role !== "admin") throw new Error("Only group admins can edit the group");
  const updateObj: any = {};
  if (data.name !== undefined) updateObj.name = data.name;
  if (data.description !== undefined) updateObj.description = data.description;
  if (data.locationCity !== undefined) updateObj.locationCity = data.locationCity;
  if (data.photo !== undefined) updateObj.photo = data.photo;
  if (Object.keys(updateObj).length > 0) {
    await db.update(groups).set(updateObj).where(eq(groups.id, groupId));
  }
}

// =============================================================================
// LOGIN STREAK TRACKING
// =============================================================================

export async function updateLoginStreak(userId: number) {
  const db = await getDb();
  const [user] = await db.select({
    currentStreak: users.currentStreak,
    longestStreak: users.longestStreak,
    lastLoginDate: users.lastLoginDate,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
  const lastLoginDay = lastLogin
    ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate())
    : null;

  // Already logged in today
  if (lastLoginDay && today.getTime() === lastLoginDay.getTime()) return;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak: number;
  if (lastLoginDay && yesterday.getTime() === lastLoginDay.getTime()) {
    // Consecutive day — increment streak
    newStreak = (user.currentStreak || 0) + 1;
  } else {
    // Streak broken — reset to 1
    newStreak = 1;
  }

  const newLongest = Math.max(newStreak, user.longestStreak || 0);
  await db.update(users).set({
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastLoginDate: now,
  }).where(eq(users.id, userId));
}

// =============================================================================
// LEADERBOARD QUERIES
// =============================================================================

export async function getLeaderboard(type: string = "xp", limit: number = 50, period: string = "all") {
  const db = await getDb();

  // For weekly non-XP types, compute from game data in the past 7 days
  if (period === "weekly" && type !== "xp") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Compute weekly games/wins per user from game_participants + games completed this week
    const weeklyStats = await db.select({
      userId: gameParticipants.userId,
      weeklyGames: sql<number>`COUNT(DISTINCT ${games.id})`.as("weeklyGames"),
      weeklyWins: sql<number>`SUM(CASE
        WHEN (${gameResults.winnerTeam} = 'team1' AND JSON_CONTAINS(${gameResults.team1PlayerIds}, CAST(${gameParticipants.userId} AS JSON)))
          OR (${gameResults.winnerTeam} = 'team2' AND JSON_CONTAINS(${gameResults.team2PlayerIds}, CAST(${gameParticipants.userId} AS JSON)))
        THEN 1 ELSE 0 END)`.as("weeklyWins"),
    }).from(gameParticipants)
      .innerJoin(games, eq(games.id, gameParticipants.gameId))
      .leftJoin(gameResults, eq(gameResults.gameId, games.id))
      .where(and(
        eq(gameParticipants.status, "confirmed"),
        eq(games.status, "completed"),
        gte(games.completedAt, weekAgo),
      ))
      .groupBy(gameParticipants.userId);

    const statsMap = new Map(weeklyStats.map(s => [s.userId, s]));

    // Get all active users and merge with weekly stats
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      showFullName: users.showFullName,
      profilePhotoUrl: users.profilePhotoUrl,
      hasProfilePhoto: users.hasProfilePhoto,
      gender: users.gender,
      xp: users.xp,
      weeklyXp: users.weeklyXp,
      level: users.level,
      currentStreak: users.currentStreak,
      totalGames: users.totalGames,
      totalWins: users.totalWins,
      isPremium: users.isPremium,
      isVerified: users.isVerified,
      skillLevel: users.skillLevel,
    }).from(users)
      .where(and(eq(users.isDeleted, false), eq(users.isActive, true)));

    return allUsers
      .map(u => ({
        ...u,
        weeklyGames: statsMap.get(u.id)?.weeklyGames ?? 0,
        weeklyWins: statsMap.get(u.id)?.weeklyWins ?? 0,
      }))
      .filter(u => {
        if (type === "wins") return (u.weeklyWins ?? 0) > 0;
        if (type === "games") return (u.weeklyGames ?? 0) > 0;
        return true; // streak: show all since we use currentStreak
      })
      .sort((a, b) => {
        if (type === "wins") return (b.weeklyWins ?? 0) - (a.weeklyWins ?? 0);
        if (type === "games") return (b.weeklyGames ?? 0) - (a.weeklyGames ?? 0);
        return (b.currentStreak ?? 0) - (a.currentStreak ?? 0); // streak uses current value
      })
      .slice(0, limit);
  }

  let orderCol;
  if (period === "weekly" && type === "xp") {
    orderCol = users.weeklyXp;
  } else {
    switch (type) {
      case "streak": orderCol = users.currentStreak; break;
      case "games": orderCol = users.totalGames; break;
      case "wins": orderCol = users.totalWins; break;
      default: orderCol = users.xp;
    }
  }
  return db.select({
    id: users.id,
    name: users.name,
    nickname: users.nickname,
    showFullName: users.showFullName,
    profilePhotoUrl: users.profilePhotoUrl,
    hasProfilePhoto: users.hasProfilePhoto,
    gender: users.gender,
    xp: users.xp,
    weeklyXp: users.weeklyXp,
    level: users.level,
    currentStreak: users.currentStreak,
    totalGames: users.totalGames,
    totalWins: users.totalWins,
    isPremium: users.isPremium,
    isVerified: users.isVerified,
    skillLevel: users.skillLevel,
  }).from(users)
    .where(and(eq(users.isDeleted, false), eq(users.isActive, true)))
    .orderBy(desc(orderCol))
    .limit(limit);
}

// =============================================================================
// USER PHOTOS
// =============================================================================

export async function getUserPhotos(userId: number) {
  const db = await getDb();
  return db.select().from(userPhotos).where(eq(userPhotos.userId, userId)).orderBy(asc(userPhotos.sortOrder));
}

export async function addUserPhoto(userId: number, photoUrl: string) {
  const db = await getDb();
  // Get current photo count for sort order
  const existing = await db.select({ count: sql<number>`COUNT(*)` }).from(userPhotos).where(eq(userPhotos.userId, userId));
  const count = existing[0]?.count ?? 0;
  const isPrimary = count === 0;
  const [inserted] = await db.insert(userPhotos).values({
    userId,
    photoUrl,
    sortOrder: count,
    isPrimary,
  });
  // If this is the first photo, also set it as profile photo
  if (isPrimary) {
    await db.update(users).set({ profilePhotoUrl: photoUrl, hasProfilePhoto: true }).where(eq(users.id, userId));
  }
  return { id: inserted.insertId, isPrimary };
}

export async function removeUserPhoto(userId: number, photoId: number) {
  const db = await getDb();
  const [photo] = await db.select().from(userPhotos).where(and(eq(userPhotos.id, photoId), eq(userPhotos.userId, userId))).limit(1);
  if (!photo) return;
  await db.delete(userPhotos).where(eq(userPhotos.id, photoId));
  // If was primary, set next photo as primary (or clear profile)
  if (photo.isPrimary) {
    const remaining = await db.select().from(userPhotos).where(eq(userPhotos.userId, userId)).orderBy(asc(userPhotos.sortOrder)).limit(1);
    if (remaining.length > 0) {
      await db.update(userPhotos).set({ isPrimary: true }).where(eq(userPhotos.id, remaining[0].id));
      await db.update(users).set({ profilePhotoUrl: remaining[0].photoUrl, hasProfilePhoto: true }).where(eq(users.id, userId));
    } else {
      await db.update(users).set({ profilePhotoUrl: null, hasProfilePhoto: false }).where(eq(users.id, userId));
    }
  }
}

export async function setPrimaryPhoto(userId: number, photoId: number) {
  const db = await getDb();
  // Unset all primary
  await db.update(userPhotos).set({ isPrimary: false }).where(eq(userPhotos.userId, userId));
  // Set new primary
  const [photo] = await db.select().from(userPhotos).where(and(eq(userPhotos.id, photoId), eq(userPhotos.userId, userId))).limit(1);
  if (!photo) return;
  await db.update(userPhotos).set({ isPrimary: true }).where(eq(userPhotos.id, photoId));
  await db.update(users).set({ profilePhotoUrl: photo.photoUrl, hasProfilePhoto: true }).where(eq(users.id, userId));
}

export async function reorderUserPhotos(userId: number, photoIds: number[]) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (let i = 0; i < photoIds.length; i++) {
      await tx.update(userPhotos).set({ sortOrder: i }).where(and(eq(userPhotos.id, photoIds[i]), eq(userPhotos.userId, userId)));
    }
  });
}

// =============================================================================
// COMPLETE ONBOARDING
// =============================================================================

export async function completeOnboarding(userId: number, data: {
  name?: string; nickname?: string; dateOfBirth?: Date; age?: number; skillLevel?: string; vibe?: string;
  pace?: string; playStyle?: string; goals?: string; courtPreference?: string;
  handedness?: string; gender?: string; availabilityWeekdays?: boolean;
  availabilityWeekends?: boolean; availabilityMornings?: boolean;
  availabilityAfternoons?: boolean; availabilityEvenings?: boolean;
}) {
  const db = await getDb();
  // Calculate profile completion based on fields provided
  const profileFields = [
    data.name, data.nickname, data.skillLevel, data.vibe,
    data.pace, data.playStyle, data.goals, data.courtPreference,
    data.handedness, data.gender,
  ];
  const boolFields = [
    data.availabilityWeekdays, data.availabilityWeekends,
    data.availabilityMornings, data.availabilityAfternoons, data.availabilityEvenings,
  ];
  const totalFields = profileFields.length + boolFields.length;
  const filledFields = profileFields.filter(f => f != null && f !== "").length
    + boolFields.filter(f => f != null).length;
  // Base 30% for completing onboarding + up to 70% for field completeness
  const profileCompletion = Math.min(100, 30 + Math.round((filledFields / totalFields) * 70));
  await db.update(users).set({
    ...data,
    onboardingCompleted: true,
    profileCompletion,
    updatedAt: new Date(),
  } as any).where(eq(users.id, userId));
}

// =============================================================================
// SANITIZATION & ENRICHED QUERIES
// =============================================================================

/** Strip sensitive fields from any user row */
export function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, 'passwordHash'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

/** Get nearby users with computed distance (miles), passwordHash stripped */
export async function getNearbyUsersWithDistance(userId: number, lat: number, lng: number, radiusMiles: number, opts?: { minRating?: number; maxRating?: number }) {
  const db = await getDb();
  const degreeRadius = radiusMiles / 69;
  const conditions = [
    ne(users.id, userId),
    eq(users.isDeleted, false),
    eq(users.isActive, true),
    eq(users.ghostMode, false),
    sql`${users.latitude} IS NOT NULL`,
    sql`${users.longitude} IS NOT NULL`,
    sql`${users.latitude} BETWEEN ${lat - degreeRadius} AND ${lat + degreeRadius}`,
    sql`${users.longitude} BETWEEN ${lng - degreeRadius} AND ${lng + degreeRadius}`,
  ];
  if (opts?.minRating != null) conditions.push(sql`${users.averageRating} >= ${opts.minRating}`);
  if (opts?.maxRating != null) conditions.push(sql`${users.averageRating} <= ${opts.maxRating}`);
  const rows = await db.select().from(users).where(and(...conditions));
  return rows.map(u => {
    const dLat = (u.latitude! - lat) * Math.PI / 180;
    const dLng = (u.longitude! - lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(u.latitude! * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const distance = 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { ...sanitizeUser(u), distance: Math.round(distance * 10) / 10 };
  }).sort((a, b) => a.distance - b.distance);
}

/** Get user matches with the matched user's profile, last message, and unread count */
export async function getUserMatchesEnriched(userId: number) {
  const db = await getDb();
  const matchRows = await db.select().from(matches).where(
    and(
      or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)),
      eq(matches.isActive, true),
    )
  );
  if (matchRows.length === 0) return [];

  // Batch fetch all other user IDs
  const otherIds = matchRows.map(m => m.user1Id === userId ? m.user2Id : m.user1Id);
  const uniqueOtherIds = Array.from(new Set(otherIds));
  const otherUsers = uniqueOtherIds.length > 0
    ? await db.select().from(users).where(sql`${users.id} IN (${sql.join(uniqueOtherIds.map(id => sql`${id}`), sql`, `)})`)
    : [];
  const userMap = new Map(otherUsers.map(u => [u.id, u]));

  // Batch fetch all conversations where this user participates
  const myParticipations = await db.select().from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));
  const myConvIds = myParticipations.map(p => p.conversationId);

  // Batch fetch all conversation participants for those conversations (to find which conv matches which other user)
  let allParticipants: { conversationId: number; userId: number }[] = [];
  if (myConvIds.length > 0) {
    allParticipants = await db.select({
      conversationId: conversationParticipants.conversationId,
      userId: conversationParticipants.userId,
    }).from(conversationParticipants)
      .where(sql`${conversationParticipants.conversationId} IN (${sql.join(myConvIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Build a map: otherId -> conversationId
  const otherIdToConvId = new Map<number, number>();
  for (const p of allParticipants) {
    if (p.userId !== userId && uniqueOtherIds.includes(p.userId)) {
      otherIdToConvId.set(p.userId, p.conversationId);
    }
  }

  // Batch fetch last message for each conversation using a subquery approach
  const convIds = Array.from(new Set(otherIdToConvId.values()));
  let lastMsgByConv = new Map<number, { content: string | null; sentAt: Date }>();
  let unreadByConv = new Map<number, number>();

  if (convIds.length > 0) {
    // Get last message per conversation
    const lastMsgRows = await db.select({
      conversationId: messages.conversationId,
      content: messages.content,
      sentAt: messages.sentAt,
    }).from(messages)
      .where(and(
        sql`${messages.conversationId} IN (${sql.join(convIds.map(id => sql`${id}`), sql`, `)})`,
        eq(messages.isDeleted, false),
      ))
      .orderBy(desc(messages.sentAt));

    // Keep only the first (newest) per conversation
    for (const row of lastMsgRows) {
      if (!lastMsgByConv.has(row.conversationId)) {
        lastMsgByConv.set(row.conversationId, { content: row.content, sentAt: row.sentAt });
      }
    }

    // Batch count unread per conversation.
    // CRITICAL: Uses a pure SQL JOIN so that sentAt vs lastReadAt comparison
    // stays entirely within MySQL. Drizzle's db.select() returns Date objects
    // offset by the server's local timezone; passing those back as parameters
    // causes a multi-hour shift that makes already-read messages appear unread.
    const unreadRows: { conversationId: number; count: number }[] = convIds.length > 0
      ? ((await db.execute(sql`
          SELECT m.conversationId, COUNT(*) as count
          FROM messages m
          JOIN conversation_participants cp
            ON cp.conversationId = m.conversationId AND cp.userId = ${userId}
          WHERE m.conversationId IN (${sql.join(convIds.map(id => sql`${id}`), sql`, `)})
            AND m.senderId != ${userId}
            AND m.isDeleted = false
            AND (cp.lastReadAt IS NULL OR m.sentAt > cp.lastReadAt)
          GROUP BY m.conversationId
        `)) as unknown as [any[], any])[0]
      : [];

    for (const row of unreadRows) {
      unreadByConv.set(row.conversationId, Number(row.count));
    }
  }

  const results = [];
  for (const m of matchRows) {
    const otherId = m.user1Id === userId ? m.user2Id : m.user1Id;
    const otherUser = userMap.get(otherId);
    if (!otherUser) continue;
    const convId = otherIdToConvId.get(otherId) ?? null;
    const lastMsg = convId ? lastMsgByConv.get(convId) : null;
    results.push({
      id: m.id,
      matchedAt: m.matchedAt,
      user: sanitizeUser(otherUser),
      conversationId: convId,
      lastMessage: lastMsg?.content ?? null,
      lastMessageAt: lastMsg?.sentAt ?? m.matchedAt,
      unreadCount: convId ? (unreadByConv.get(convId) ?? 0) : 0,
    });
  }

  return results.sort((a, b) => {
    const aTime = a.lastMessageAt?.getTime() ?? 0;
    const bTime = b.lastMessageAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

/** Get messages with sender info */
export async function getMessagesEnriched(conversationId: number, limit: number, cursor?: number) {
  const db = await getDb();
  const conditions = [eq(messages.conversationId, conversationId), eq(messages.isDeleted, false)];
  if (cursor) conditions.push(sql`${messages.id} < ${cursor}`);
  const rows = await db.select({
    id: messages.id,
    conversationId: messages.conversationId,
    senderId: messages.senderId,
    senderName: users.name,
    senderAvatar: users.profilePhotoUrl,
    content: messages.content,
    messageType: messages.messageType,
    locationLat: messages.locationLat,
    locationLng: messages.locationLng,
    locationName: messages.locationName,
    sentAt: messages.sentAt,
    readAt: messages.readAt,
  }).from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(and(...conditions))
    .orderBy(asc(messages.sentAt))
    .limit(limit);
  return rows;
}

/** Get games with participant count and details */
export async function getUserGamesEnriched(userId: number, status?: string) {
  const db = await getDb();
  const participantRows = await db.select({ gameId: gameParticipants.gameId })
    .from(gameParticipants)
    .where(eq(gameParticipants.userId, userId));
  const organizedRows = await db.select({ id: games.id }).from(games).where(eq(games.organizerId, userId));
  const gameIdSet = new Set([...participantRows.map(r => r.gameId), ...organizedRows.map(r => r.id)]);
  const allGameIds = Array.from(gameIdSet);
  if (allGameIds.length === 0) return [];
  const conditions: any[] = [sql`${games.id} IN (${sql.join(allGameIds.map(id => sql`${id}`), sql`, `)})`];
  if (status) conditions.push(eq(games.status, status as any));
  const gameRows = await db.select().from(games).where(and(...conditions)).orderBy(desc(games.scheduledAt));
  if (gameRows.length === 0) return [];

  // Batch fetch all participants for all games at once
  const gameIds = gameRows.map(g => g.id);
  const allParticipants = await db.select({
    gameId: gameParticipants.gameId,
    userId: gameParticipants.userId,
    status: gameParticipants.status,
    name: users.name,
    profilePhotoUrl: users.profilePhotoUrl,
  }).from(gameParticipants)
    .leftJoin(users, eq(gameParticipants.userId, users.id))
    .where(sql`${gameParticipants.gameId} IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})`);

  const participantsByGame = new Map<number, any[]>();
  for (const p of allParticipants) {
    if (!participantsByGame.has(p.gameId)) participantsByGame.set(p.gameId, []);
    participantsByGame.get(p.gameId)!.push(p);
  }

  return gameRows.map(game => ({
    ...game,
    currentPlayers: (participantsByGame.get(game.id) ?? []).filter(p => p.status === "confirmed").length,
    participants: participantsByGame.get(game.id) ?? [],
  }));
}

/** Get all games linked to a specific group, enriched with participant info */
export async function getGroupGames(groupId: number) {
  const db = await getDb();
  const gameRows = await db.select().from(games)
    .where(eq(games.groupId, groupId))
    .orderBy(desc(games.scheduledAt))
    .limit(50);
  if (gameRows.length === 0) return [];

  const gameIds = gameRows.map(g => g.id);
  const allParticipants = await db.select({
    gameId: gameParticipants.gameId,
    userId: gameParticipants.userId,
    status: gameParticipants.status,
    name: users.name,
    profilePhotoUrl: users.profilePhotoUrl,
  }).from(gameParticipants)
    .leftJoin(users, eq(gameParticipants.userId, users.id))
    .where(sql`${gameParticipants.gameId} IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})`);

  const participantsByGame = new Map<number, any[]>();
  for (const p of allParticipants) {
    if (!participantsByGame.has(p.gameId)) participantsByGame.set(p.gameId, []);
    participantsByGame.get(p.gameId)!.push(p);
  }

  return gameRows.map(game => ({
    ...game,
    currentPlayers: (participantsByGame.get(game.id) ?? []).filter(p => p.status === "confirmed").length,
    participants: participantsByGame.get(game.id) ?? [],
  }));
}

/** Get all upcoming games (public) with participant details */
export async function getUpcomingGames(userId: number, lat?: number, lng?: number) {
  const db = await getDb();
  // Get both open games AND games where user is a participant (including private/closed ones)
  // If location is provided, filter to games within ~50 miles using bounding box
  const conditions = [eq(games.status, "scheduled")];
  if (lat != null && lng != null) {
    const milesRadius = 50;
    const latDelta = milesRadius / 69;
    const lngDelta = milesRadius / (69 * Math.cos(lat * Math.PI / 180));
    conditions.push(
      sql`(${games.locationLat} IS NULL OR (${games.locationLat} BETWEEN ${lat - latDelta} AND ${lat + latDelta} AND ${games.locationLng} BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}))`,
    );
  }
  const gameRows = await db.select().from(games)
    .where(and(...conditions))
    .orderBy(asc(games.scheduledAt))
    .limit(50);
  if (gameRows.length === 0) return [];

  // Fetch matched user IDs so private games from matches are visible
  const matchRows = await db.select({ user1Id: matches.user1Id, user2Id: matches.user2Id })
    .from(matches)
    .where(and(
      sql`(${matches.user1Id} = ${userId} OR ${matches.user2Id} = ${userId})`,
      eq(matches.isActive, true),
    ));
  const matchedUserIds = new Set(matchRows.map(m => m.user1Id === userId ? m.user2Id : m.user1Id));

  // Batch fetch all participants for all games at once
  const gameIds = gameRows.map(g => g.id);
  const allParticipants = await db.select({
    gameId: gameParticipants.gameId,
    userId: gameParticipants.userId,
    status: gameParticipants.status,
    name: users.name,
    profilePhotoUrl: users.profilePhotoUrl,
  }).from(gameParticipants)
    .leftJoin(users, eq(gameParticipants.userId, users.id))
    .where(sql`${gameParticipants.gameId} IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})`);

  const participantsByGame = new Map<number, any[]>();
  for (const p of allParticipants) {
    if (!participantsByGame.has(p.gameId)) participantsByGame.set(p.gameId, []);
    participantsByGame.get(p.gameId)!.push(p);
  }

  // Filter: show game if it's open, OR if user is organizer/participant, OR if organizer is a match
  const enriched = gameRows
    .filter(game => {
      const isOrganizer = game.organizerId === userId;
      const participants = participantsByGame.get(game.id) ?? [];
      const isParticipant = participants.some(p => p.userId === userId);
      if (isOrganizer || isParticipant) return true;
      // Private games are visible to matched users (organizer is a match)
      const organizerIsMatch = matchedUserIds.has(game.organizerId);
      // For non-participants: show open games that aren't full, or private games from matches
      if (!game.isOpen && !organizerIsMatch) return false;
      const confirmedCount = participants.filter(p => p.status === "confirmed").length;
      if (confirmedCount >= (game.maxPlayers ?? 4)) return false;
      return true;
    })
    .map(game => ({
      ...game,
      currentPlayers: (participantsByGame.get(game.id) ?? []).filter(p => p.status === "confirmed").length,
      participants: participantsByGame.get(game.id) ?? [],
    }));

  return enriched;
}

/** Get achievements with details joined */
export async function getUserAchievementsEnriched(userId: number) {
  const db = await getDb();
  const allAchievs = await db.select().from(achievements);
  const userAchievs = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
  const userMap = new Map(userAchievs.map(ua => [ua.achievementId, ua]));

  return allAchievs.map(a => {
    const ua = userMap.get(a.id);
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      points: a.points,
      earnedAt: ua?.earnedAt ?? null,
      claimedAt: ua?.claimedAt ?? null,
      progress: ua?.progress ?? 0,
      maxProgress: ua?.maxProgress ?? 100,
    };
  });
}

/** Get endorsements for a user, grouped by type with count */
export async function getEndorsementsSummary(userId: number) {
  const db = await getDb();
  const rows = await db.select({
    type: endorsements.endorsementType,
    count: sql<number>`COUNT(*)`,
  }).from(endorsements)
    .where(eq(endorsements.userId, userId))
    .groupBy(endorsements.endorsementType);
  return rows;
}

/** Get swipe candidates (nearby users not yet swiped) */
export async function getSwipeCandidates(userId: number, lat: number, lng: number, radiusMiles: number, filters?: { vibe?: string; skillLevel?: string; ageMin?: number; ageMax?: number }) {
  const db = await getDb();
  const alreadySwiped = await db.select({ swipedId: swipes.swipedId })
    .from(swipes)
    .where(eq(swipes.swiperId, userId));
  const swipedIds = new Set(alreadySwiped.map(r => r.swipedId));
  swipedIds.add(userId); // exclude self

  // Also exclude blocked users
  const blockedIds = await getBlockedUserIds(userId);
  for (const id of Array.from(blockedIds)) swipedIds.add(id);

  const nearby = await getNearbyUsersWithDistance(userId, lat, lng, radiusMiles);
  let filtered = nearby.filter(u => !swipedIds.has(u.id));

  // Apply optional filters
  if (filters?.vibe) {
    filtered = filtered.filter(u => (u as any).vibe === filters.vibe || (u as any).vibe === "both");
  }
  if (filters?.skillLevel) {
    filtered = filtered.filter(u => (u as any).skillLevel === filters.skillLevel);
  }
  if (filters?.ageMin) {
    filtered = filtered.filter(u => (u as any).age != null && (u as any).age >= filters.ageMin!);
  }
  if (filters?.ageMax) {
    filtered = filtered.filter(u => (u as any).age != null && (u as any).age <= filters.ageMax!);
  }

  if (filtered.length === 0) return [];

  // Batch-fetch photos for all candidates in a single query
  const candidateIds = filtered.map(u => u.id);
  const allPhotos = await db.select().from(userPhotos)
    .where(sql`${userPhotos.userId} IN (${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(asc(userPhotos.sortOrder));
  const photosByUser = new Map<number, typeof allPhotos>();
  for (const photo of allPhotos) {
    const existing = photosByUser.get(photo.userId) ?? [];
    existing.push(photo);
    photosByUser.set(photo.userId, existing);
  }

  // Batch-fetch endorsement counts for all candidates
  const endorsementRows = await db.select({
    userId: endorsements.userId,
    endorsementType: endorsements.endorsementType,
    cnt: sql<number>`COUNT(*)`,
  }).from(endorsements)
    .where(sql`${endorsements.userId} IN (${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(endorsements.userId, endorsements.endorsementType);
  const endorsementsByUser = new Map<number, Record<string, number>>();
  for (const row of endorsementRows) {
    const existing = endorsementsByUser.get(row.userId) ?? {};
    existing[row.endorsementType] = Number(row.cnt);
    endorsementsByUser.set(row.userId, existing);
  }

  // Sort: boosted profiles first (priority matching for premium), then by distance
  const now = new Date();
  filtered.sort((a, b) => {
    const aBoosted = (a as any).profileBoostedUntil && new Date((a as any).profileBoostedUntil) > now ? 1 : 0;
    const bBoosted = (b as any).profileBoostedUntil && new Date((b as any).profileBoostedUntil) > now ? 1 : 0;
    return bBoosted - aBoosted; // boosted first
  });

  return filtered.map(u => ({ ...u, photos: photosByUser.get(u.id) ?? [], endorsementCounts: endorsementsByUser.get(u.id) ?? {} }));
}

/** Get conversation participants */
export async function getConversationParticipants(conversationId: number) {
  const db = await getDb();
  return db.select({
    userId: conversationParticipants.userId,
    name: users.name,
    nickname: users.nickname,
    profilePhotoUrl: users.profilePhotoUrl,
    hasProfilePhoto: users.hasProfilePhoto,
  }).from(conversationParticipants)
    .leftJoin(users, eq(conversationParticipants.userId, users.id))
    .where(and(eq(conversationParticipants.conversationId, conversationId), isNull(conversationParticipants.leftAt)));
}

// =============================================================================
// PUSH SUBSCRIPTIONS
// =============================================================================

export async function savePushSubscription(userId: number, subscription: { type: "web-push"; endpoint: string; keys: { p256dh: string; auth: string } } | { type: "fcm"; token: string }) {
  const db = await getDb();
  const endpoint = subscription.type === "fcm" ? `fcm:${subscription.token}` : subscription.endpoint;
  const p256dh = subscription.type === "fcm" ? "fcm" : subscription.keys.p256dh;
  const auth = subscription.type === "fcm" ? "fcm" : subscription.keys.auth;
  // Remove existing subscription for this endpoint (re-subscribe)
  await db.delete(pushSubscriptions).where(and(
    eq(pushSubscriptions.userId, userId),
    eq(pushSubscriptions.endpoint, endpoint),
  ));
  await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh, auth });
}

export async function getUserPushSubscriptions(userId: number) {
  const db = await getDb();
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function removePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  await db.delete(pushSubscriptions).where(and(
    eq(pushSubscriptions.userId, userId),
    eq(pushSubscriptions.endpoint, endpoint),
  ));
}

// =============================================================================
// PASSWORD RESET TOKENS
// =============================================================================

export async function createPasswordResetToken(userId: number, token: string) {
  const db = await getDb();
  // Invalidate any existing tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
}

export async function verifyPasswordResetToken(token: string): Promise<number | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const result = await tx.select().from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.token, token), isNull(passwordResetTokens.usedAt)))
      .for("update")
      .limit(1);
    if (!result.length) return null;
    if (new Date() > result[0].expiresAt) return null;
    // Mark as used atomically within the transaction
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, result[0].id));
    return result[0].userId;
  });
}

export async function resetUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

// =============================================================================
// ACCOUNT DELETION TOKENS
// =============================================================================

export async function createAccountDeletionToken(userId: number, token: string) {
  const db = await getDb();
  await db.delete(accountDeletionTokens).where(eq(accountDeletionTokens.userId, userId));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await db.insert(accountDeletionTokens).values({ userId, token, expiresAt });
}

export async function verifyAccountDeletionToken(token: string): Promise<number | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const result = await tx.select().from(accountDeletionTokens)
      .where(eq(accountDeletionTokens.token, token))
      .for("update")
      .limit(1);
    if (!result.length) return null;
    if (new Date() > result[0].expiresAt) return null;
    // Delete the token atomically within the transaction
    await tx.delete(accountDeletionTokens).where(eq(accountDeletionTokens.id, result[0].id));
    return result[0].userId;
  });
}

// =============================================================================
// GLOBAL SEARCH
// =============================================================================

export async function globalSearch(query: string, userId: number, limit = 20) {
  const db = await getDb();

  const escaped = query.replace(/[%_\\]/g, '\\$&');
  const searchTerm = `%${escaped}%`;

  // Get blocked users to filter them out
  const blockedIds = await getBlockedUserIds(userId);

  const [userResults, courtResults, gameResults, groupResults] = await Promise.all([
    db.select({
      id: users.id, username: users.username, name: users.name,
      profilePhotoUrl: users.profilePhotoUrl, skillLevel: users.skillLevel,
      city: users.city,
    }).from(users).where(
      and(
        or(like(users.username, searchTerm), like(users.name, searchTerm), like(users.city, searchTerm)),
        eq(users.isActive, true), eq(users.isDeleted, false), ne(users.id, userId),
      )
    ).limit(limit),

    db.select({
      id: courts.id, name: courts.name, address: courts.address,
      city: courts.city, courtType: courts.courtType, averageRating: courts.averageRating,
    }).from(courts).where(
      or(like(courts.name, searchTerm), like(courts.city, searchTerm), like(courts.address, searchTerm))
    ).limit(limit),

    db.select({
      id: games.id, locationName: games.locationName, gameType: games.gameType,
      format: games.format, scheduledAt: games.scheduledAt, status: games.status,
    }).from(games).where(
      and(
        or(like(games.locationName, searchTerm), like(games.notes, searchTerm)),
        eq(games.status, "scheduled"),
      )
    ).limit(limit),

    db.select({
      id: groups.id, name: groups.name, description: groups.description,
      groupType: groups.groupType, memberCount: groups.memberCount,
    }).from(groups).where(
      or(like(groups.name, searchTerm), like(groups.description, searchTerm))
    ).limit(limit),
  ]);

  // Filter blocked users from search results
  const filteredUsers = userResults.filter(u => !blockedIds.has(u.id));

  return { users: filteredUsers, courts: courtResults, games: gameResults, groups: groupResults };
}

// =============================================================================
// GAME RESULTS
// =============================================================================

export async function recordGameResult(recordedBy: number, data: {
  gameId: number;
  team1Score: number;
  team2Score: number;
  team1PlayerIds: number[];
  team2PlayerIds: number[];
}) {
  const db = await getDb();

  const winnerTeam = data.team1Score > data.team2Score ? "team1" as const
    : data.team2Score > data.team1Score ? "team2" as const
    : "draw" as const;

  await db.insert(gameResults).values({
    gameId: data.gameId,
    winnerTeam,
    team1Score: data.team1Score,
    team2Score: data.team2Score,
    team1PlayerIds: JSON.stringify(data.team1PlayerIds),
    team2PlayerIds: JSON.stringify(data.team2PlayerIds),
    recordedBy,
    scoreConfirmedBy: JSON.stringify([recordedBy]),
  });

  return { winnerTeam, team1Score: data.team1Score, team2Score: data.team2Score };
}

export async function confirmGameScore(userId: number, gameId: number) {
  const db = await getDb();
  return await db.transaction(async (tx) => {
    // Lock the result row to prevent concurrent confirm race
    const [result] = await tx.select().from(gameResults).where(eq(gameResults.gameId, gameId)).for("update").limit(1);
    if (!result) throw new Error("No game result found");
    const confirmed: number[] = result.scoreConfirmedBy ? JSON.parse(result.scoreConfirmedBy) : [];
    if (confirmed.includes(userId)) throw new Error("You already confirmed this score");
    confirmed.push(userId);
    await tx.update(gameResults)
      .set({ scoreConfirmedBy: JSON.stringify(confirmed) })
      .where(eq(gameResults.gameId, gameId));
    return { confirmed: true, totalConfirmations: confirmed.length };
  });
}

export async function disputeGameScore(userId: number, gameId: number) {
  const db = await getDb();
  const [result] = await db.select().from(gameResults).where(eq(gameResults.gameId, gameId)).limit(1);
  if (!result) throw new Error("No game result found");
  await db.update(gameResults)
    .set({ scoreDisputed: true })
    .where(eq(gameResults.gameId, gameId));
  return { disputed: true };
}

export async function getGameResult(gameId: number) {
  const db = await getDb();
  const result = await db.select().from(gameResults).where(eq(gameResults.gameId, gameId)).limit(1);
  if (!result.length) return null;
  return {
    ...result[0],
    team1PlayerIds: result[0].team1PlayerIds ? JSON.parse(result[0].team1PlayerIds) : [],
    team2PlayerIds: result[0].team2PlayerIds ? JSON.parse(result[0].team2PlayerIds) : [],
    scoreConfirmedBy: result[0].scoreConfirmedBy ? JSON.parse(result[0].scoreConfirmedBy) : [],
  };
}

// =============================================================================
// GAME PLAY TRACKING
// =============================================================================

/** Start a game (set status to in-progress). Only organizer can start. */
export async function startGame(userId: number, gameId: number, settings?: { pointsToWin?: number; bestOf?: number; winBy?: number }) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) throw new Error("Game not found");
  // Allow organizer or any confirmed participant to start
  if (game.organizerId !== userId) {
    const [participant] = await db.select({ id: gameParticipants.id }).from(gameParticipants)
      .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId), eq(gameParticipants.status, "confirmed")))
      .limit(1);
    if (!participant) throw new Error("Only the organizer or a confirmed participant can start the game");
  }
  if (game.status !== "scheduled") throw new Error("Game is not in a startable state");
  const updateSet: Record<string, unknown> = { status: "in-progress", isOpen: false, startedAt: new Date() };
  if (settings?.pointsToWin) updateSet.pointsToWin = settings.pointsToWin;
  if (settings?.bestOf) updateSet.bestOf = settings.bestOf;
  if (settings?.winBy) updateSet.winBy = settings.winBy;
  await db.update(games).set(updateSet as any).where(eq(games.id, gameId));
  return { success: true };
}

/** Save team assignments for a game */
export async function saveTeamAssignments(userId: number, gameId: number, team1PlayerIds: number[], team2PlayerIds: number[]) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) throw new Error("Game not found");
  if (game.organizerId !== userId) throw new Error("Only the organizer can assign teams");
  // Store team assignments in gameResults (upsert pattern)
  const existing = await db.select().from(gameResults).where(eq(gameResults.gameId, gameId)).limit(1);
  if (existing.length > 0) {
    await db.update(gameResults).set({
      team1PlayerIds: JSON.stringify(team1PlayerIds),
      team2PlayerIds: JSON.stringify(team2PlayerIds),
    }).where(eq(gameResults.gameId, gameId));
  } else {
    await db.insert(gameResults).values({
      gameId,
      team1Score: 0,
      team2Score: 0,
      team1PlayerIds: JSON.stringify(team1PlayerIds),
      team2PlayerIds: JSON.stringify(team2PlayerIds),
      recordedBy: userId,
    });
  }
  return { success: true };
}

/** Atomically save teams + start game in one transaction */
export async function startGameWithTeams(userId: number, gameId: number, team1PlayerIds: number[], team2PlayerIds: number[], settings?: { pointsToWin?: number; bestOf?: number; winBy?: number }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [game] = await tx.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (!game) throw new Error("Game not found");
    // Allow organizer or any confirmed participant to start
    if (game.organizerId !== userId) {
      const [participant] = await tx.select({ id: gameParticipants.id }).from(gameParticipants)
        .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId), eq(gameParticipants.status, "confirmed")))
        .limit(1);
      if (!participant) throw new Error("Only the organizer or a confirmed participant can start the game");
    }
    if (game.status !== "scheduled") throw new Error("Game is not in a startable state");
    // Save team assignments
    const existing = await tx.select().from(gameResults).where(eq(gameResults.gameId, gameId)).limit(1);
    if (existing.length > 0) {
      await tx.update(gameResults).set({
        team1PlayerIds: JSON.stringify(team1PlayerIds),
        team2PlayerIds: JSON.stringify(team2PlayerIds),
      }).where(eq(gameResults.gameId, gameId));
    } else {
      await tx.insert(gameResults).values({
        gameId,
        team1Score: 0,
        team2Score: 0,
        team1PlayerIds: JSON.stringify(team1PlayerIds),
        team2PlayerIds: JSON.stringify(team2PlayerIds),
        recordedBy: userId,
      });
    }
    // Start the game
    const updateSet: Record<string, unknown> = { status: "in-progress", isOpen: false, startedAt: new Date() };
    if (settings?.pointsToWin) updateSet.pointsToWin = settings.pointsToWin;
    if (settings?.bestOf) updateSet.bestOf = settings.bestOf;
    if (settings?.winBy) updateSet.winBy = settings.winBy;
    await tx.update(games).set(updateSet as any).where(eq(games.id, gameId));
  });
  return { success: true };
}

/** Add or update a game round */
export async function saveGameRound(userId: number, gameId: number, data: {
  roundNumber: number;
  team1Score: number;
  team2Score: number;
  winnerTeam?: "team1" | "team2";
  completed?: boolean;
}) {
  const db = await getDb();
  return await db.transaction(async (tx) => {
    // Lock the game row to prevent concurrent round saves
    const lockResult = await tx.execute(sql`SELECT id, organizerId, status FROM games WHERE id = ${gameId} FOR UPDATE`);
    const game = (lockResult as any)[0]?.[0];
    if (!game) throw new Error("Game not found");
    if (game.status !== "in-progress") throw new Error("Game is not in progress");
    const isOrganizer = game.organizerId === userId;
    if (!isOrganizer) {
      const [participant] = await tx.select({ id: gameParticipants.id })
        .from(gameParticipants)
        .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId)))
        .limit(1);
      if (!participant) throw new Error("Only participants or the organizer can update rounds");
    }

    // Check if round exists (within the same transaction)
    const [existing] = await tx.select().from(gameRounds)
      .where(and(eq(gameRounds.gameId, gameId), eq(gameRounds.roundNumber, data.roundNumber)))
      .for("update")
      .limit(1);

    if (existing) {
      const updateSet: Record<string, unknown> = {
        team1Score: data.team1Score,
        team2Score: data.team2Score,
      };
      if (data.winnerTeam) updateSet.winnerTeam = data.winnerTeam;
      if (data.completed) updateSet.completedAt = sql`NOW()`;
      await tx.update(gameRounds).set(updateSet as any).where(eq(gameRounds.id, existing.id));
      return { id: existing.id, updated: true };
    } else {
      const [round] = await tx.insert(gameRounds).values({
        gameId,
        roundNumber: data.roundNumber,
        team1Score: data.team1Score,
        team2Score: data.team2Score,
        winnerTeam: data.winnerTeam,
        completedAt: data.completed ? sql`NOW()` : undefined,
      }).$returningId();
      return { id: round.id, updated: false };
    }
  });
}

/** Get all rounds for a game (auth: must be participant or organizer) */
export async function getGameRounds(userId: number, gameId: number) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) throw new Error("Game not found");
  const isOrganizer = game.organizerId === userId;
  if (!isOrganizer) {
    const [participant] = await db.select({ id: gameParticipants.id })
      .from(gameParticipants)
      .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId)))
      .limit(1);
    if (!participant) throw new Error("Only participants or the organizer can view rounds");
  }
  return await db.select().from(gameRounds).where(eq(gameRounds.gameId, gameId)).orderBy(asc(gameRounds.roundNumber));
}

/** Complete a game with final results (uses FOR UPDATE to prevent race conditions) */
export async function completeGame(userId: number, gameId: number, data: {
  team1Score: number;
  team2Score: number;
  team1PlayerIds: number[];
  team2PlayerIds: number[];
}) {
  const db = await getDb();

  return await db.transaction(async (tx) => {
    // Lock the game row to prevent concurrent completion
    const lockResult = await tx.execute(sql`SELECT id, organizerId, status, startedAt FROM games WHERE id = ${gameId} FOR UPDATE`);
    const gameRow = (lockResult as any)[0]?.[0];
    if (!gameRow) throw new Error("Game not found");
    // Allow organizer or any confirmed participant to complete the game
    if (gameRow.organizerId !== userId) {
      const [participant] = await tx.select({ id: gameParticipants.id }).from(gameParticipants)
        .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.userId, userId), eq(gameParticipants.status, "confirmed")))
        .limit(1);
      if (!participant) throw new Error("Only the organizer or a confirmed participant can complete the game");
    }
    if (gameRow.status !== "in-progress") throw new Error("Game is not in progress or already completed");

    // Compute authoritative totals from saved rounds (prevents stale-closure client bugs)
    const savedRounds = await tx.select().from(gameRounds).where(eq(gameRounds.gameId, gameId));
    const totalT1 = savedRounds.reduce((sum, r) => sum + r.team1Score, 0);
    const totalT2 = savedRounds.reduce((sum, r) => sum + r.team2Score, 0);
    // Use server-computed totals; fall back to client values only if no rounds exist
    const finalT1 = savedRounds.length > 0 ? totalT1 : data.team1Score;
    const finalT2 = savedRounds.length > 0 ? totalT2 : data.team2Score;

    const winnerTeam = finalT1 > finalT2 ? "team1" as const
      : finalT2 > finalT1 ? "team2" as const
      : "draw" as const;

    // Use MySQL NOW() for timezone-safe completion time and duration
    await tx.execute(sql`UPDATE games SET status = 'completed', isOpen = false, completedAt = NOW(),
      durationMinutes = CASE WHEN startedAt IS NOT NULL THEN GREATEST(1, ROUND(TIMESTAMPDIFF(SECOND, startedAt, NOW()) / 60)) ELSE durationMinutes END
      WHERE id = ${gameId}`);

    // Upsert game results (lock the result row too)
    const [existing] = await tx.select().from(gameResults).where(eq(gameResults.gameId, gameId)).for("update").limit(1);
    if (existing) {
      await tx.update(gameResults).set({
        winnerTeam,
        team1Score: finalT1,
        team2Score: finalT2,
        team1PlayerIds: JSON.stringify(data.team1PlayerIds),
        team2PlayerIds: JSON.stringify(data.team2PlayerIds),
        recordedBy: userId,
        scoreConfirmedBy: existing.scoreConfirmedBy, // preserve existing confirmations
      }).where(eq(gameResults.gameId, gameId));
    } else {
      await tx.insert(gameResults).values({
        gameId,
        winnerTeam,
        team1Score: finalT1,
        team2Score: finalT2,
        team1PlayerIds: JSON.stringify(data.team1PlayerIds),
        team2PlayerIds: JSON.stringify(data.team2PlayerIds),
        recordedBy: userId,
      });
    }

    // Increment totalGames for all confirmed participants
    const participants = await tx.select({ userId: gameParticipants.userId })
      .from(gameParticipants).where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.status, "confirmed")));
    if (participants.length > 0) {
      const participantIds = participants.map(p => p.userId);
      await tx.update(users).set({ totalGames: sql`${users.totalGames} + 1` })
        .where(sql`${users.id} IN (${sql.join(participantIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // Track wins/losses
    if (winnerTeam !== "draw") {
      const winnerIds = winnerTeam === "team1" ? data.team1PlayerIds : data.team2PlayerIds;
      const loserIds = winnerTeam === "team1" ? data.team2PlayerIds : data.team1PlayerIds;
      if (winnerIds.length > 0) {
        await tx.update(users).set({ totalWins: sql`${users.totalWins} + 1` })
          .where(sql`${users.id} IN (${sql.join(winnerIds.map(id => sql`${id}`), sql`, `)})`);
      }
      if (loserIds.length > 0) {
        await tx.update(users).set({ totalLosses: sql`${users.totalLosses} + 1` })
          .where(sql`${users.id} IN (${sql.join(loserIds.map(id => sql`${id}`), sql`, `)})`);
      }
    }

    return { winnerTeam, team1Score: finalT1, team2Score: finalT2 };
  });
}

/** Get full game scoreboard: game info + rounds + result + participants */
export async function getGameScoreboard(gameId: number) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return null;

  const rounds = await db.select().from(gameRounds).where(eq(gameRounds.gameId, gameId)).orderBy(asc(gameRounds.roundNumber));
  const [result] = await db.select().from(gameResults).where(eq(gameResults.gameId, gameId)).limit(1);
  const participants = await db.select({
    userId: gameParticipants.userId,
    status: gameParticipants.status,
    name: users.name,
    nickname: users.nickname,
    username: users.username,
    profilePhotoUrl: users.profilePhotoUrl,
    hasProfilePhoto: users.hasProfilePhoto,
  }).from(gameParticipants)
    .innerJoin(users, eq(gameParticipants.userId, users.id))
    .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.status, "confirmed")));

  return {
    game,
    rounds,
    result: result ? {
      ...result,
      team1PlayerIds: result.team1PlayerIds ? JSON.parse(result.team1PlayerIds) : [],
      team2PlayerIds: result.team2PlayerIds ? JSON.parse(result.team2PlayerIds) : [],
    } : null,
    participants,
  };
}

// =============================================================================
// ENDORSEMENT DUPLICATE CHECK
// =============================================================================

export async function hasExistingEndorsement(endorserId: number, userId: number, type: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.select({ id: endorsements.id }).from(endorsements)
    .where(and(
      eq(endorsements.endorserId, endorserId),
      eq(endorsements.userId, userId),
      eq(endorsements.endorsementType, type as any),
    ))
    .limit(1);
  return result.length > 0;
}
// =============================================================================
// TOURNAMENT QUERIES
// =============================================================================

export async function createTournament(organizerId: number, data: {
  name: string;
  description?: string;
  format: "single-elimination" | "double-elimination" | "round-robin";
  gameFormat: "singles" | "mens-doubles" | "womens-doubles" | "mixed-doubles";
  maxParticipants: number;
  entryFee?: number;
  prizeDescription?: string;
  pointsToWin?: number;
  bestOf?: number;
  winBy?: number;
  courtId?: number;
  locationLat?: number;
  locationLng?: number;
  locationName?: string;
  skillLevelMin?: string;
  skillLevelMax?: string;
  registrationDeadline?: string;
  startDate: string;
  endDate?: string;
  rules?: string;
  isPublic?: boolean;
  requiresApproval?: boolean;
  groupId?: number;
}) {
  const db = await getDb();
  const [result] = await db.insert(tournaments).values({
    organizerId,
    groupId: data.groupId ?? null,
    name: data.name,
    description: data.description ?? null,
    format: data.format as any,
    gameFormat: data.gameFormat as any,
    maxParticipants: data.maxParticipants,
    entryFee: data.entryFee ?? null,
    prizeDescription: data.prizeDescription ?? null,
    pointsToWin: data.pointsToWin ?? 11,
    bestOf: data.bestOf ?? 3,
    winBy: data.winBy ?? 2,
    courtId: data.courtId ?? null,
    locationLat: data.locationLat ?? null,
    locationLng: data.locationLng ?? null,
    locationName: data.locationName ?? null,
    skillLevelMin: data.skillLevelMin ?? null,
    skillLevelMax: data.skillLevelMax ?? null,
    registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
    startDate: new Date(data.startDate),
    endDate: data.endDate ? new Date(data.endDate) : null,
    rules: data.rules ?? null,
    isPublic: data.isPublic ?? true,
    requiresApproval: data.requiresApproval ?? false,
    status: "registration",
  }).$returningId();

  // Organizer auto-registers
  await db.insert(tournamentParticipants).values({
    tournamentId: result.id,
    userId: organizerId,
    status: "confirmed",
  });

  return { id: result.id };
}

export async function getTournaments(filters?: { status?: string; userId?: number }) {
  const db = await getDb();
  const conditions = [eq(tournaments.isPublic, true)];
  if (filters?.status) conditions.push(eq(tournaments.status, filters.status as any));

  const rows = await db.select({
    tournament: tournaments,
    participantCount: sql<number>`(SELECT COUNT(*) FROM ${tournamentParticipants} WHERE ${tournamentParticipants.tournamentId} = ${tournaments.id} AND ${tournamentParticipants.status} != 'withdrawn')`,
    organizerId: users.id,
    organizerName: users.name,
    organizerNickname: users.nickname,
    organizerPhoto: users.profilePhotoUrl,
  }).from(tournaments)
    .leftJoin(users, eq(users.id, tournaments.organizerId))
    .where(and(...conditions))
    .orderBy(desc(tournaments.createdAt));

  return rows.map(r => ({
    ...r.tournament,
    participantCount: r.participantCount ?? 0,
    organizer: r.organizerId ? { id: r.organizerId, name: r.organizerName, nickname: r.organizerNickname, profilePhotoUrl: r.organizerPhoto } : null,
  }));
}

export async function getMyTournaments(userId: number) {
  const db = await getDb();
  // Tournaments the user is participating in or organizing
  const participatingIds = await db.select({ tournamentId: tournamentParticipants.tournamentId })
    .from(tournamentParticipants).where(eq(tournamentParticipants.userId, userId));
  const organizedIds = await db.select({ id: tournaments.id })
    .from(tournaments).where(eq(tournaments.organizerId, userId));

  const allIds = new Set([
    ...participatingIds.map(p => p.tournamentId),
    ...organizedIds.map(o => o.id),
  ]);
  if (allIds.size === 0) return [];

  const rows = await db.select({
    tournament: tournaments,
    participantCount: sql<number>`(SELECT COUNT(*) FROM ${tournamentParticipants} WHERE ${tournamentParticipants.tournamentId} = ${tournaments.id} AND ${tournamentParticipants.status} != 'withdrawn')`,
    organizerId: users.id,
    organizerName: users.name,
    organizerNickname: users.nickname,
    organizerPhoto: users.profilePhotoUrl,
  }).from(tournaments)
    .leftJoin(users, eq(users.id, tournaments.organizerId))
    .where(inArray(tournaments.id, Array.from(allIds)))
    .orderBy(desc(tournaments.startDate));

  return rows.map(r => ({
    ...r.tournament,
    participantCount: r.participantCount ?? 0,
    organizer: r.organizerId ? { id: r.organizerId, name: r.organizerName, nickname: r.organizerNickname, profilePhotoUrl: r.organizerPhoto } : null,
  }));
}

export async function getTournamentById(tournamentId: number, userId?: number) {
  const db = await getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return null;

  // Private tournament access check: organizer and participants can view
  if (!tournament.isPublic && userId) {
    const isOrganizer = tournament.organizerId === userId;
    if (!isOrganizer) {
      const [participation] = await db.select({ id: tournamentParticipants.id })
        .from(tournamentParticipants)
        .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)))
        .limit(1);
      if (!participation) return null;
    }
  } else if (!tournament.isPublic && !userId) {
    return null;
  }

  const [organizer] = await db.select({ id: users.id, name: users.name, nickname: users.nickname, profilePhotoUrl: users.profilePhotoUrl })
    .from(users).where(eq(users.id, tournament.organizerId)).limit(1);

  const participants = await db.select({
    id: tournamentParticipants.id,
    tournamentId: tournamentParticipants.tournamentId,
    userId: tournamentParticipants.userId,
    partnerId: tournamentParticipants.partnerId,
    seed: tournamentParticipants.seed,
    status: tournamentParticipants.status,
    wins: tournamentParticipants.wins,
    losses: tournamentParticipants.losses,
    pointDiff: tournamentParticipants.pointDiff,
    placement: tournamentParticipants.placement,
    registeredAt: tournamentParticipants.registeredAt,
    userName: users.name,
    userNickname: users.nickname,
    userPhoto: users.profilePhotoUrl,
    userSkillLevel: users.skillLevel,
  }).from(tournamentParticipants)
    .innerJoin(users, eq(tournamentParticipants.userId, users.id))
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
    .orderBy(asc(tournamentParticipants.seed));

  const matchRows = await db.select().from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, tournamentId))
    .orderBy(asc(tournamentMatches.roundNumber), asc(tournamentMatches.matchNumber));

  return {
    ...tournament,
    organizer: organizer || null,
    participants,
    matches: matchRows,
    participantCount: participants.filter(p => p.status !== "withdrawn").length,
  };
}

export async function joinTournament(userId: number, tournamentId: number, partnerId?: number) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments)
      .where(eq(tournaments.id, tournamentId)).for("update").limit(1);
    if (!tournament) throw new Error("Tournament not found");
    if (tournament.status !== "registration") throw new Error("Registration is closed");

    // Check registration deadline
    if (tournament.registrationDeadline && new Date() > tournament.registrationDeadline) {
      throw new Error("Registration deadline has passed");
    }

    // Check capacity
    const [count] = await tx.select({ count: sql<number>`COUNT(*)` })
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournamentId), ne(tournamentParticipants.status, "withdrawn" as any)));
    if ((count?.count ?? 0) >= tournament.maxParticipants) throw new Error("Tournament is full");

    // Check duplicate — allow re-joining if previously withdrawn
    const [existing] = await tx.select({ id: tournamentParticipants.id, status: tournamentParticipants.status })
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)))
      .limit(1);
    if (existing && existing.status !== "withdrawn") throw new Error("Already registered");

    const status = tournament.requiresApproval ? "registered" : "confirmed";

    if (existing && existing.status === "withdrawn") {
      // Re-activate withdrawn participant
      await tx.update(tournamentParticipants)
        .set({ status: status as any, partnerId: partnerId ?? null })
        .where(eq(tournamentParticipants.id, existing.id));
    } else {
      await tx.insert(tournamentParticipants).values({
        tournamentId,
        userId,
        partnerId: partnerId ?? null,
        status: status as any,
      });
    }

    // Notify organizer
    const [joiner] = await tx.select({ name: users.name, nickname: users.nickname })
      .from(users).where(eq(users.id, userId)).limit(1);
    const joinerName = joiner?.nickname || joiner?.name || "Someone";
    await createNotification(tournament.organizerId, {
      type: "tournament_invite",
      title: `${joinerName} joined your tournament!`,
      content: `${joinerName} registered for "${tournament.name}"`,
      targetId: tournamentId,
    });

    return { status };
  });
}

export async function leaveTournament(userId: number, tournamentId: number) {
  const db = await getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.organizerId === userId) throw new Error("Organizer cannot leave their own tournament");
  if (tournament.status === "in-progress") throw new Error("Cannot leave a tournament in progress");

  await db.update(tournamentParticipants)
    .set({ status: "withdrawn" as any })
    .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)));
  return { success: true };
}

export async function updateTournament(organizerId: number, tournamentId: number, data: {
  name?: string;
  description?: string;
  rules?: string;
  maxParticipants?: number;
  registrationDeadline?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  isPublic?: boolean;
  prizeDescription?: string;
}) {
  const db = await getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.organizerId !== organizerId) throw new Error("Only the organizer can update this tournament");

  // Prevent modifications to active/completed tournaments (except name/description/rules)
  if (tournament.status === "in-progress" || tournament.status === "completed") {
    const allowedWhileActive = ["name", "description", "rules", "prizeDescription"];
    const disallowed = Object.keys(data).filter(k => (data as any)[k] !== undefined && !allowedWhileActive.includes(k));
    if (disallowed.length > 0) throw new Error("Cannot change " + disallowed.join(", ") + " while tournament is " + tournament.status);
  }

  // Validate maxParticipants not below current count
  if (data.maxParticipants !== undefined) {
    const [currentCount] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournamentId), ne(tournamentParticipants.status, "withdrawn" as any)));
    if (data.maxParticipants < (currentCount?.count ?? 0)) {
      throw new Error(`Cannot reduce max participants below current count (${currentCount?.count ?? 0})`);
    }
  }

  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.rules !== undefined) updates.rules = data.rules;
  if (data.maxParticipants !== undefined) updates.maxParticipants = data.maxParticipants;
  if (data.registrationDeadline !== undefined) updates.registrationDeadline = new Date(data.registrationDeadline);
  if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updates.endDate = new Date(data.endDate);
  if (data.status !== undefined) {
    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      draft: ["registration", "cancelled"],
      registration: ["seeding", "cancelled"],
      seeding: ["registration", "cancelled"],
      "in-progress": ["cancelled"],
      completed: [],
      cancelled: [],
    };
    const allowed = validTransitions[tournament.status] ?? [];
    if (!allowed.includes(data.status)) {
      throw new Error(`Cannot change status from "${tournament.status}" to "${data.status}"`);
    }
    updates.status = data.status;
  }
  if (data.isPublic !== undefined) updates.isPublic = data.isPublic;
  if (data.prizeDescription !== undefined) updates.prizeDescription = data.prizeDescription;

  if (Object.keys(updates).length > 0) {
    await db.update(tournaments).set(updates).where(eq(tournaments.id, tournamentId));
  }
  return { success: true };
}

export async function seedTournamentBracket(organizerId: number, tournamentId: number, isAdmin = false) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments)
      .where(eq(tournaments.id, tournamentId)).for("update").limit(1);
    if (!tournament) throw new Error("Tournament not found");
    if (tournament.organizerId !== organizerId && !isAdmin) throw new Error("Only the organizer or an admin can seed the bracket");
    if (tournament.status !== "registration" && tournament.status !== "seeding") {
      throw new Error("Tournament cannot be seeded in its current state");
    }

    // Get confirmed participants
    const participants = await tx.select().from(tournamentParticipants)
      .where(and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.status, "confirmed" as any),
      ));

    if (participants.length < 2) throw new Error("Need at least 2 participants to generate a bracket");

    // Remove any existing matches for this tournament (in case of re-seed)
    await tx.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));

    // Assign seeds based on registration order (organizer can manually reorder later)
    for (let i = 0; i < participants.length; i++) {
      await tx.update(tournamentParticipants)
        .set({ seed: i + 1 })
        .where(eq(tournamentParticipants.id, participants[i].id));
    }

    const format = tournament.format;
    let totalRounds = 0;
    const matchInserts: any[] = [];

    if (format === "single-elimination" || format === "double-elimination") {
      // Calculate bracket size (next power of 2)
      const n = participants.length;
      const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
      totalRounds = Math.ceil(Math.log2(bracketSize));
      const numByes = bracketSize - n;

      // Generate first round with seeded matchups (1 vs N, 2 vs N-1, etc.)
      const seeds = participants.map((_, i) => i + 1);
      const firstRoundMatchCount = bracketSize / 2;
      const matchups: { seed1: number | null; seed2: number | null; isBye: boolean }[] = [];

      for (let i = 0; i < firstRoundMatchCount; i++) {
        const s1 = seeds[i] ?? null;
        const s2 = seeds[bracketSize - 1 - i] ?? null;
        const isBye = s1 === null || s2 === null || s1 > n || s2 > n;
        matchups.push({ seed1: s1 && s1 <= n ? s1 : null, seed2: s2 && s2 <= n ? s2 : null, isBye });
      }

      // Create matches for each round
      let matchCounter = 1;
      // First round
      for (let i = 0; i < matchups.length; i++) {
        const mu = matchups[i];
        const s1 = mu.seed1;
        const s2 = mu.seed2;
        const p1 = s1 && s1 <= n ? participants[s1 - 1] : null;
        const p2 = s2 && s2 <= n ? participants[s2 - 1] : null;

        matchInserts.push({
          tournamentId,
          roundNumber: 1,
          matchNumber: matchCounter++,
          participant1Id: p1?.id ?? null,
          participant2Id: p2?.id ?? null,
          isBye: mu.isBye || !p1 || !p2,
          status: (mu.isBye || !p1 || !p2) ? "completed" : "ready",
          winnerId: mu.isBye ? (p1?.id ?? p2?.id ?? null) : null,
        });
      }

      // Subsequent rounds (empty slots, will be filled as winners advance)
      for (let round = 2; round <= totalRounds; round++) {
        const matchesInRound = Math.pow(2, totalRounds - round);
        for (let i = 0; i < matchesInRound; i++) {
          matchInserts.push({
            tournamentId,
            roundNumber: round,
            matchNumber: matchCounter++,
            participant1Id: null,
            participant2Id: null,
            isBye: false,
            status: "pending",
          });
        }
      }

      // If double elimination, add losers bracket rounds
      // Standard double-elimination: losers bracket has 2*(winnersRounds-1) rounds, then grand final
      if (format === "double-elimination") {
        const losersRoundCount = 2 * (totalRounds - 1);
        let losersMatchCount = bracketSize / 2; // First losers round has same count as winners R1
        for (let lr = 1; lr <= losersRoundCount; lr++) {
          // Odd losers rounds: absorb drop-downs from winners (same match count as prev)
          // Even losers rounds: halve the bracket
          if (lr % 2 === 0) losersMatchCount = Math.max(1, Math.floor(losersMatchCount / 2));
          for (let i = 0; i < losersMatchCount; i++) {
            matchInserts.push({
              tournamentId,
              roundNumber: totalRounds + lr,
              matchNumber: matchCounter++,
              participant1Id: null,
              participant2Id: null,
              isBye: false,
              status: "pending",
            });
          }
        }
        // Grand final (winners bracket champion vs losers bracket champion)
        matchInserts.push({
          tournamentId,
          roundNumber: totalRounds + losersRoundCount + 1,
          matchNumber: matchCounter++,
          participant1Id: null,
          participant2Id: null,
          isBye: false,
          status: "pending",
        });
        totalRounds = totalRounds + losersRoundCount + 1;
      }
    } else if (format === "round-robin") {
      // Round-robin: circle method for proper scheduling
      const n = participants.length;
      // If odd number of players, add a dummy "BYE" slot
      const pIds: (number | null)[] = participants.map(p => p.id);
      if (n % 2 !== 0) pIds.push(null); // null = BYE
      const numSlots = pIds.length;
      totalRounds = numSlots - 1;
      let matchCounter = 1;

      // Circle method: fix first element, rotate the rest
      const fixed = pIds[0];
      const rotating = pIds.slice(1);

      for (let round = 0; round < totalRounds; round++) {
        const currentOrder = [fixed, ...rotating];
        const half = numSlots / 2;
        for (let i = 0; i < half; i++) {
          const p1 = currentOrder[i];
          const p2 = currentOrder[numSlots - 1 - i];
          // Skip matches involving the BYE slot
          if (p1 === null || p2 === null) continue;
          matchInserts.push({
            tournamentId,
            roundNumber: round + 1,
            matchNumber: matchCounter++,
            participant1Id: p1,
            participant2Id: p2,
            isBye: false,
            status: "ready",
          });
        }
        // Rotate: move last element to the front
        rotating.unshift(rotating.pop()!);
      }
    }

    // Insert all matches
    if (matchInserts.length > 0) {
      await tx.insert(tournamentMatches).values(matchInserts);
    }

    // Now set nextMatchId for elimination formats
    if (format === "single-elimination" || format === "double-elimination") {
      const insertedMatches = await tx.select().from(tournamentMatches)
        .where(eq(tournamentMatches.tournamentId, tournamentId))
        .orderBy(asc(tournamentMatches.roundNumber), asc(tournamentMatches.matchNumber));

      // Group by round
      const byRound: Record<number, typeof insertedMatches> = {};
      for (const m of insertedMatches) {
        if (!byRound[m.roundNumber]) byRound[m.roundNumber] = [];
        byRound[m.roundNumber].push(m);
      }

      // Link winners bracket matches
      const winnersRounds = Math.ceil(Math.log2(Math.pow(2, Math.ceil(Math.log2(participants.length)))));
      for (let round = 1; round < winnersRounds; round++) {
        const currentRound = byRound[round] || [];
        const nextRound = byRound[round + 1] || [];
        for (let i = 0; i < currentRound.length; i++) {
          const nextMatchIdx = Math.floor(i / 2);
          if (nextRound[nextMatchIdx]) {
            await tx.update(tournamentMatches)
              .set({ nextMatchId: nextRound[nextMatchIdx].id })
              .where(eq(tournamentMatches.id, currentRound[i].id));
          }
        }
      }

      // Link losers bracket for double-elimination
      if (format === "double-elimination") {
        // Link loserNextMatchId: winners bracket losers drop to losers bracket
        for (let round = 1; round <= winnersRounds; round++) {
          const currentRound = byRound[round] || [];
          const targetLosersRound = byRound[winnersRounds + (round === 1 ? 1 : 2 * (round - 1) - 1)] || [];
          for (let i = 0; i < currentRound.length; i++) {
            const targetIdx = Math.min(i, targetLosersRound.length - 1);
            if (targetLosersRound[targetIdx]) {
              await tx.update(tournamentMatches)
                .set({ loserNextMatchId: targetLosersRound[targetIdx].id })
                .where(eq(tournamentMatches.id, currentRound[i].id));
            }
          }
        }

        // Link losers bracket internal progression
        const losersStart = winnersRounds + 1;
        const losersEnd = Object.keys(byRound).map(Number).sort((a, b) => a - b).pop() || losersStart;
        for (let round = losersStart; round < losersEnd; round++) {
          const currentRound = byRound[round] || [];
          const nextRound = byRound[round + 1] || [];
          for (let i = 0; i < currentRound.length; i++) {
            const nextIdx = (round - losersStart) % 2 === 0 ? i : Math.floor(i / 2);
            if (nextRound[nextIdx]) {
              await tx.update(tournamentMatches)
                .set({ nextMatchId: nextRound[nextIdx].id })
                .where(eq(tournamentMatches.id, currentRound[i].id));
            }
          }
        }
      }

      // Auto-advance bye winners to next round
      const firstRound = byRound[1] || [];
      const secondRound = byRound[2] || [];
      for (let i = 0; i < firstRound.length; i++) {
        const match = firstRound[i];
        if (match.isBye && match.winnerId) {
          const nextIdx = Math.floor(i / 2);
          if (secondRound[nextIdx]) {
            const slot = i % 2 === 0 ? "participant1Id" : "participant2Id";
            await tx.update(tournamentMatches)
              .set({ [slot]: match.winnerId })
              .where(eq(tournamentMatches.id, secondRound[nextIdx].id));
          }
        }
      }
    }

    // Update tournament status
    await tx.update(tournaments).set({
      status: "in-progress",
      currentRound: 1,
      totalRounds,
    }).where(eq(tournaments.id, tournamentId));

    // Notify all participants
    for (const p of participants) {
      if (p.userId !== organizerId) {
        await createNotification(p.userId, {
          type: "tournament_invite",
          title: `Tournament "${tournament.name}" is starting!`,
          content: "The bracket has been set. Check your first match!",
          targetId: tournamentId,
        });
      }
    }

    return { totalRounds, matchCount: matchInserts.length };
  });
}

export async function getTournamentBracket(tournamentId: number, userId?: number) {
  const db = await getDb();

  // Privacy check before returning bracket
  const [tournament] = await db.select({ isPublic: tournaments.isPublic, organizerId: tournaments.organizerId })
    .from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return { rounds: {}, participantMap: {} };
  if (!tournament.isPublic && userId) {
    const isOrganizer = tournament.organizerId === userId;
    if (!isOrganizer) {
      const [participation] = await db.select({ id: tournamentParticipants.id })
        .from(tournamentParticipants)
        .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)))
        .limit(1);
      if (!participation) return { rounds: {}, participantMap: {} };
    }
  } else if (!tournament.isPublic && !userId) {
    return { rounds: {}, participantMap: {} };
  }

  const matchRows = await db.select().from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, tournamentId))
    .orderBy(asc(tournamentMatches.roundNumber), asc(tournamentMatches.matchNumber));

  // Enrich with participant names
  const participantIds = new Set<number>();
  for (const m of matchRows) {
    if (m.participant1Id) participantIds.add(m.participant1Id);
    if (m.participant2Id) participantIds.add(m.participant2Id);
  }

  const participantMap: Record<number, { userId: number; name: string; seed: number | null }> = {};
  if (participantIds.size > 0) {
    const pRows = await db.select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      seed: tournamentParticipants.seed,
      name: users.name,
      nickname: users.nickname,
    }).from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.id))
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
    for (const p of pRows) {
      participantMap[p.id] = { userId: p.userId, name: p.nickname || p.name || "Unknown", seed: p.seed };
    }
  }

  // Group matches by round
  const rounds: Record<number, any[]> = {};
  for (const m of matchRows) {
    if (!rounds[m.roundNumber]) rounds[m.roundNumber] = [];
    rounds[m.roundNumber].push({
      ...m,
      participant1: m.participant1Id ? participantMap[m.participant1Id] || null : null,
      participant2: m.participant2Id ? participantMap[m.participant2Id] || null : null,
      winner: m.winnerId ? participantMap[m.winnerId] || null : null,
    });
  }

  return { rounds, participantMap };
}

export async function startTournamentMatch(organizerId: number, tournamentId: number, matchId: number) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments)
      .where(eq(tournaments.id, tournamentId)).limit(1);
    if (!tournament) throw new Error("Tournament not found");
    if (tournament.organizerId !== organizerId) throw new Error("Only the organizer can start matches");

    const [match] = await tx.select().from(tournamentMatches)
      .where(eq(tournamentMatches.id, matchId)).for("update").limit(1);
    if (!match) throw new Error("Match not found");
    if (match.status !== "ready") throw new Error("Match is not ready to start");
    if (!match.participant1Id || !match.participant2Id) throw new Error("Both participants must be set");

    // Get participant user IDs
    const [p1] = await tx.select({ userId: tournamentParticipants.userId })
      .from(tournamentParticipants).where(eq(tournamentParticipants.id, match.participant1Id)).limit(1);
    const [p2] = await tx.select({ userId: tournamentParticipants.userId })
      .from(tournamentParticipants).where(eq(tournamentParticipants.id, match.participant2Id)).limit(1);
    if (!p1 || !p2) throw new Error("Participants not found");

    // Create a live game for this match
    const [game] = await tx.insert(games).values({
      organizerId: tournament.organizerId,
      courtId: tournament.courtId,
      locationName: tournament.locationName,
      scheduledAt: match.scheduledAt || new Date(),
      durationMinutes: 60,
      gameType: "tournament" as any,
      format: tournament.gameFormat as any,
      maxPlayers: tournament.gameFormat === "singles" ? 2 : 4,
      status: "in-progress",
      notes: `${tournament.name} - Round ${match.roundNumber}, Match ${match.matchNumber}`,
    }).$returningId();

    // Add participants to the game
    await tx.insert(gameParticipants).values([
      { gameId: game.id, userId: p1.userId, status: "confirmed" },
      { gameId: game.id, userId: p2.userId, status: "confirmed" },
    ]);

    // Link game to tournament match
    await tx.update(tournamentMatches).set({
      gameId: game.id,
      status: "in-progress",
      startedAt: new Date(),
    }).where(eq(tournamentMatches.id, matchId));

    return { gameId: game.id, matchId };
  });
}

export async function reportTournamentMatchResult(organizerId: number, tournamentId: number, matchId: number, winnerId: number) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments)
      .where(eq(tournaments.id, tournamentId)).limit(1);
    if (!tournament) throw new Error("Tournament not found");
    if (tournament.organizerId !== organizerId) throw new Error("Only the organizer can report results");

    const [match] = await tx.select().from(tournamentMatches)
      .where(eq(tournamentMatches.id, matchId)).for("update").limit(1);
    if (!match) throw new Error("Match not found");
    if (match.status === "completed") throw new Error("Match already completed");
    if (match.participant1Id !== winnerId && match.participant2Id !== winnerId) {
      throw new Error("Winner must be a participant in this match");
    }

    const loserId = winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;

    // Update match result
    await tx.update(tournamentMatches).set({
      winnerId,
      loserId,
      status: "completed",
      completedAt: new Date(),
    }).where(eq(tournamentMatches.id, matchId));

    // Update participant stats
    await tx.update(tournamentParticipants).set({
      wins: sql`${tournamentParticipants.wins} + 1`,
    }).where(eq(tournamentParticipants.id, winnerId));

    if (loserId) {
      await tx.update(tournamentParticipants).set({
        losses: sql`${tournamentParticipants.losses} + 1`,
      }).where(eq(tournamentParticipants.id, loserId));

      // Mark loser as eliminated in single elimination; route to losers bracket in double
      if (tournament.format === "single-elimination") {
        await tx.update(tournamentParticipants).set({
          status: "eliminated" as any,
        }).where(eq(tournamentParticipants.id, loserId));
      } else if (tournament.format === "double-elimination") {
        // Check if loser already has a loss (already in losers bracket) — if so, eliminated
        const [loserStats] = await tx.select({ losses: tournamentParticipants.losses })
          .from(tournamentParticipants).where(eq(tournamentParticipants.id, loserId)).limit(1);
        if ((loserStats?.losses ?? 0) >= 2) {
          await tx.update(tournamentParticipants).set({
            status: "eliminated" as any,
          }).where(eq(tournamentParticipants.id, loserId));
        }
      }
    }

    // Advance winner to next match
    if (match.nextMatchId) {
      const [nextMatch] = await tx.select().from(tournamentMatches)
        .where(eq(tournamentMatches.id, match.nextMatchId)).limit(1);
      if (nextMatch) {
        const slot = !nextMatch.participant1Id ? "participant1Id" : "participant2Id";
        await tx.update(tournamentMatches).set({
          [slot]: winnerId,
          status: nextMatch.participant1Id || slot === "participant2Id" ? "ready" : nextMatch.status,
        }).where(eq(tournamentMatches.id, match.nextMatchId));
      }
    }

    // Route loser to losers bracket (double-elimination only)
    if (loserId && match.loserNextMatchId && tournament.format === "double-elimination") {
      const [loserNext] = await tx.select().from(tournamentMatches)
        .where(eq(tournamentMatches.id, match.loserNextMatchId)).limit(1);
      if (loserNext) {
        const slot = !loserNext.participant1Id ? "participant1Id" : "participant2Id";
        await tx.update(tournamentMatches).set({
          [slot]: loserId,
          status: loserNext.participant1Id || slot === "participant2Id" ? "ready" : loserNext.status,
        }).where(eq(tournamentMatches.id, match.loserNextMatchId));
      }
    }

    // Check if tournament is complete
    const [pendingMatches] = await tx.select({ count: sql<number>`COUNT(*)` })
      .from(tournamentMatches)
      .where(and(
        eq(tournamentMatches.tournamentId, tournamentId),
        ne(tournamentMatches.status, "completed" as any),
        eq(tournamentMatches.isBye, false),
      ));

    if ((pendingMatches?.count ?? 0) === 0) {
      // Tournament is complete — set final placements for ALL participants
      const [winnerParticipant] = await tx.select({ userId: tournamentParticipants.userId })
        .from(tournamentParticipants).where(eq(tournamentParticipants.id, winnerId)).limit(1);
      const runnerUp = loserId
        ? await tx.select({ userId: tournamentParticipants.userId }).from(tournamentParticipants).where(eq(tournamentParticipants.id, loserId)).limit(1)
        : [];

      await tx.update(tournamentParticipants).set({ placement: 1 }).where(eq(tournamentParticipants.id, winnerId));
      if (loserId) {
        await tx.update(tournamentParticipants).set({ placement: 2 }).where(eq(tournamentParticipants.id, loserId));
      }

      // Calculate placements for remaining participants based on the round they were eliminated
      if (tournament.format === "single-elimination" || tournament.format === "double-elimination") {
        const allMatches = await tx.select().from(tournamentMatches)
          .where(and(eq(tournamentMatches.tournamentId, tournamentId), eq(tournamentMatches.status, "completed")))
          .orderBy(desc(tournamentMatches.roundNumber));
        const totalRoundsVal = allMatches.length > 0 ? Math.max(...allMatches.map(m => m.roundNumber)) : 1;
        // Assign placements: eliminated in final round = 3rd-4th, semis = 5th-8th, etc.
        const eliminatedByRound = new Map<number, number[]>();
        for (const m of allMatches) {
          if (m.loserId && m.loserId !== loserId) { // runner-up already placed
            const arr = eliminatedByRound.get(m.roundNumber) || [];
            arr.push(m.loserId);
            eliminatedByRound.set(m.roundNumber, arr);
          }
        }
        let placementCounter = 3; // Start after winner(1) and runner-up(2)
        for (let round = totalRoundsVal; round >= 1; round--) {
          const losers = eliminatedByRound.get(round) || [];
          const startPlacement = placementCounter;
          for (const pid of losers) {
            await tx.update(tournamentParticipants).set({ placement: startPlacement }).where(eq(tournamentParticipants.id, pid));
          }
          placementCounter += losers.length;
        }
      } else if (tournament.format === "round-robin") {
        // For round-robin, rank by wins desc, then point diff desc
        const allP = await tx.select().from(tournamentParticipants)
          .where(eq(tournamentParticipants.tournamentId, tournamentId))
          .orderBy(desc(tournamentParticipants.wins), desc(tournamentParticipants.pointDiff));
        for (let i = 0; i < allP.length; i++) {
          await tx.update(tournamentParticipants).set({ placement: i + 1 }).where(eq(tournamentParticipants.id, allP[i].id));
        }
      }

      await tx.update(tournaments).set({
        status: "completed",
        winnerId: winnerParticipant?.userId ?? null,
        runnerUpId: runnerUp[0]?.userId ?? null,
      }).where(eq(tournaments.id, tournamentId));

      // Notify all participants of results
      const allParticipants = await tx.select().from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, tournamentId));
      const winnerName = winnerParticipant?.userId
        ? await tx.select({ name: users.name, nickname: users.nickname }).from(users).where(eq(users.id, winnerParticipant.userId)).limit(1)
        : [];
      const name = winnerName[0]?.nickname || winnerName[0]?.name || "Unknown";

      for (const p of allParticipants) {
        await createNotification(p.userId, {
          type: "tournament_invite",
          title: `Tournament "${tournament.name}" Complete!`,
          content: `${name} won the tournament! Check the final standings.`,
          targetId: tournamentId,
        });
        // Award achievements
        checkAndAwardAchievements(p.userId).catch(() => {});
      }
    }

    return { winnerId, loserId, tournamentComplete: (pendingMatches?.count ?? 0) === 0 };
  });
}

export async function approveTournamentParticipant(organizerId: number, tournamentId: number, participantId: number) {
  const db = await getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament || tournament.organizerId !== organizerId) throw new Error("Not authorized");

  await db.update(tournamentParticipants)
    .set({ status: "confirmed" as any })
    .where(and(eq(tournamentParticipants.id, participantId), eq(tournamentParticipants.tournamentId, tournamentId)));
  return { success: true };
}

export async function removeTournamentParticipant(organizerId: number, tournamentId: number, participantId: number) {
  const db = await getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament || tournament.organizerId !== organizerId) throw new Error("Not authorized");

  await db.update(tournamentParticipants)
    .set({ status: "withdrawn" as any })
    .where(and(eq(tournamentParticipants.id, participantId), eq(tournamentParticipants.tournamentId, tournamentId)));
  return { success: true };
}

export async function updateParticipantSeed(organizerId: number, tournamentId: number, participantId: number, seed: number) {
  const db = await getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament || tournament.organizerId !== organizerId) throw new Error("Not authorized");

  await db.update(tournamentParticipants)
    .set({ seed })
    .where(and(eq(tournamentParticipants.id, participantId), eq(tournamentParticipants.tournamentId, tournamentId)));
  return { success: true };
}

export async function cancelTournament(organizerId: number, tournamentId: number) {
  const db = await getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament || tournament.organizerId !== organizerId) throw new Error("Not authorized");
  if (tournament.status === "completed") throw new Error("Cannot cancel a completed tournament");

  await db.update(tournaments).set({ status: "cancelled" }).where(eq(tournaments.id, tournamentId));

  // Notify all participants
  const participants = await db.select().from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, tournamentId));
  for (const p of participants) {
    if (p.userId !== organizerId) {
      await createNotification(p.userId, {
        type: "system",
        title: `Tournament "${tournament.name}" Cancelled`,
        content: "The tournament has been cancelled by the organizer.",
        targetId: tournamentId,
      });
    }
  }
  return { success: true };
}

// =============================================================================
// SWIPE UNDO
// =============================================================================
export async function undoLastSwipe(userId: number) {
  const db = await getDb();
  // Find the last swipe by this user (within the last 30 seconds)
  const thirtySecsAgo = new Date(Date.now() - 30_000);
  const [lastSwipe] = await db.select().from(swipes)
    .where(and(eq(swipes.swiperId, userId), gte(swipes.swipedAt, thirtySecsAgo)))
    .orderBy(desc(swipes.swipedAt)).limit(1);
  if (!lastSwipe) return { success: false, reason: "no-recent-swipe" };

  return await db.transaction(async (tx) => {
    // Delete the swipe
    await tx.delete(swipes).where(eq(swipes.id, lastSwipe.id));
    // Decrement daily swipe count
    await tx.update(users).set({ swipesUsedToday: sql`GREATEST(${users.swipesUsedToday} - 1, 0)` }).where(eq(users.id, userId));
    // If it was a rally, check if a match was created and undo it
    if (lastSwipe.direction === "rally") {
      const u1 = Math.min(userId, lastSwipe.swipedId);
      const u2 = Math.max(userId, lastSwipe.swipedId);
      const [match] = await tx.select().from(matches)
        .where(and(eq(matches.user1Id, u1), eq(matches.user2Id, u2), eq(matches.isActive, true)))
        .limit(1);
      if (match) {
        await tx.update(matches).set({ isActive: false, unmatchedBy: userId, unmatchedAt: new Date() }).where(eq(matches.id, match.id));
        await tx.update(users).set({ totalMatches: sql`GREATEST(${users.totalMatches} - 1, 0)` }).where(eq(users.id, userId));
        await tx.update(users).set({ totalMatches: sql`GREATEST(${users.totalMatches} - 1, 0)` }).where(eq(users.id, lastSwipe.swipedId));
      }
    }
    return { success: true, undoneSwipe: lastSwipe };
  });
}

// =============================================================================
// COURT BOOKINGS
// =============================================================================
export async function getCourtBookings(courtId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  const conditions = [eq(courtBookings.courtId, courtId), ne(courtBookings.status, "cancelled")];
  if (startDate) conditions.push(gte(courtBookings.startTime, startDate));
  if (endDate) conditions.push(sql`${courtBookings.endTime} <= ${endDate}`);
  return db.select({
    id: courtBookings.id, courtId: courtBookings.courtId, userId: courtBookings.userId,
    gameId: courtBookings.gameId, startTime: courtBookings.startTime, endTime: courtBookings.endTime,
    courtNumber: courtBookings.courtNumber, status: courtBookings.status, notes: courtBookings.notes,
    createdAt: courtBookings.createdAt,
    userName: users.name, userNickname: users.nickname, userPhoto: users.profilePhotoUrl,
  }).from(courtBookings)
    .leftJoin(users, eq(courtBookings.userId, users.id))
    .where(and(...conditions))
    .orderBy(asc(courtBookings.startTime));
}

export async function createCourtBooking(userId: number, data: {
  courtId: number; startTime: Date; endTime: Date; courtNumber?: number; gameId?: number; notes?: string;
}) {
  const db = await getDb();
  // Check for overlapping bookings on the same court/courtNumber
  const overlap = await db.select({ id: courtBookings.id }).from(courtBookings).where(and(
    eq(courtBookings.courtId, data.courtId),
    ne(courtBookings.status, "cancelled"),
    data.courtNumber != null ? eq(courtBookings.courtNumber, data.courtNumber) : sql`1=1`,
    sql`${courtBookings.startTime} < ${data.endTime}`,
    sql`${courtBookings.endTime} > ${data.startTime}`,
  )).limit(1);
  if (overlap.length > 0) throw new Error("Time slot already booked");
  const [result] = await db.insert(courtBookings).values({ userId, ...data }).$returningId();
  return { id: result.id };
}

export async function cancelCourtBooking(userId: number, bookingId: number) {
  const db = await getDb();
  const [booking] = await db.select().from(courtBookings).where(eq(courtBookings.id, bookingId)).limit(1);
  if (!booking) throw new Error("Booking not found");
  if (booking.userId !== userId) throw new Error("Not your booking");
  await db.update(courtBookings).set({ status: "cancelled" }).where(eq(courtBookings.id, bookingId));
  return { success: true };
}

export async function getUserBookings(userId: number) {
  const db = await getDb();
  return db.select({
    id: courtBookings.id, courtId: courtBookings.courtId, startTime: courtBookings.startTime,
    endTime: courtBookings.endTime, courtNumber: courtBookings.courtNumber,
    status: courtBookings.status, notes: courtBookings.notes, createdAt: courtBookings.createdAt,
    courtName: courts.name, courtAddress: courts.address,
  }).from(courtBookings)
    .leftJoin(courts, eq(courtBookings.courtId, courts.id))
    .where(and(eq(courtBookings.userId, userId), ne(courtBookings.status, "cancelled")))
    .orderBy(asc(courtBookings.startTime))
    .limit(50);
}

// =============================================================================
// ACTIVITY FEED
// =============================================================================
export async function createActivityFeedItem(userId: number, data: {
  activityType: string; title: string; description?: string; targetType?: string; targetId?: number; isPublic?: boolean;
}) {
  const db = await getDb();
  await db.insert(activityFeed).values({ userId, ...data } as any);
}

export async function getActivityFeed(userId: number, limit = 50) {
  const db = await getDb();
  // Get feed items from: the user's own activities, their matches, and public activities from nearby users
  const blockedIds = await getBlockedUserIds(userId);
  const blockedCondition = blockedIds.size > 0
    ? sql`${activityFeed.userId} NOT IN (${sql.join(Array.from(blockedIds).map(id => sql`${id}`), sql`, `)})`
    : sql`1=1`;
  return db.select({
    id: activityFeed.id, userId: activityFeed.userId, activityType: activityFeed.activityType,
    title: activityFeed.title, description: activityFeed.description,
    targetType: activityFeed.targetType, targetId: activityFeed.targetId,
    createdAt: activityFeed.createdAt,
    userName: users.name, userNickname: users.nickname, userPhoto: users.profilePhotoUrl,
    userLevel: users.level,
  }).from(activityFeed)
    .leftJoin(users, eq(activityFeed.userId, users.id))
    .where(and(eq(activityFeed.isPublic, true), blockedCondition))
    .orderBy(desc(activityFeed.createdAt))
    .limit(limit);
}

export async function getMyActivityFeed(userId: number, limit = 50) {
  const db = await getDb();
  return db.select().from(activityFeed)
    .where(eq(activityFeed.userId, userId))
    .orderBy(desc(activityFeed.createdAt))
    .limit(limit);
}

// =============================================================================
// MESSAGE REACTIONS
// =============================================================================
export async function addMessageReaction(userId: number, messageId: number, emoji: string) {
  const db = await getDb();
  // Verify user is participant of the message's conversation
  const [msg] = await db.select({ conversationId: messages.conversationId }).from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!msg) throw new Error("Message not found");
  const isParticipant = await isConversationParticipant(userId, msg.conversationId);
  if (!isParticipant) throw new Error("Not a participant");
  try {
    await db.insert(messageReactions).values({ messageId, userId, emoji });
  } catch (e: any) {
    if (e.code === "ER_DUP_ENTRY") throw new Error("Already reacted with this emoji");
    throw e;
  }
  return { success: true };
}

export async function removeMessageReaction(userId: number, messageId: number, emoji: string) {
  const db = await getDb();
  await db.delete(messageReactions).where(and(
    eq(messageReactions.messageId, messageId),
    eq(messageReactions.userId, userId),
    eq(messageReactions.emoji, emoji),
  ));
  return { success: true };
}

export async function getMessageReactions(messageIds: number[]) {
  if (messageIds.length === 0) return {};
  const db = await getDb();
  const rows = await db.select({
    messageId: messageReactions.messageId,
    userId: messageReactions.userId,
    emoji: messageReactions.emoji,
    userName: users.nickname,
  }).from(messageReactions)
    .leftJoin(users, eq(messageReactions.userId, users.id))
    .where(sql`${messageReactions.messageId} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`);

  const grouped: Record<number, Array<{ userId: number; emoji: string; userName: string | null }>> = {};
  for (const row of rows) {
    if (!grouped[row.messageId]) grouped[row.messageId] = [];
    grouped[row.messageId].push({ userId: row.userId, emoji: row.emoji, userName: row.userName });
  }
  return grouped;
}

// =============================================================================
// COURT PHOTOS
// =============================================================================
export async function addCourtPhoto(userId: number, courtId: number, photoUrl: string, caption?: string) {
  const db = await getDb();
  const [result] = await db.insert(courtPhotos).values({ courtId, userId, photoUrl, caption }).$returningId();
  return { id: result.id };
}

export async function getCourtPhotos(courtId: number) {
  const db = await getDb();
  return db.select({
    id: courtPhotos.id, photoUrl: courtPhotos.photoUrl, caption: courtPhotos.caption,
    createdAt: courtPhotos.createdAt,
    userName: users.name, userNickname: users.nickname,
  }).from(courtPhotos)
    .leftJoin(users, eq(courtPhotos.userId, users.id))
    .where(eq(courtPhotos.courtId, courtId))
    .orderBy(desc(courtPhotos.createdAt));
}

export async function deleteCourtPhoto(userId: number, photoId: number) {
  const db = await getDb();
  const [photo] = await db.select().from(courtPhotos).where(eq(courtPhotos.id, photoId)).limit(1);
  if (!photo || photo.userId !== userId) throw new Error("Cannot delete this photo");
  await db.delete(courtPhotos).where(eq(courtPhotos.id, photoId));
  return { success: true };
}

// =============================================================================
// RIVALRIES
// =============================================================================
export async function getOrCreateRivalry(userId1: number, userId2: number) {
  const db = await getDb();
  const u1 = Math.min(userId1, userId2);
  const u2 = Math.max(userId1, userId2);
  const [existing] = await db.select().from(rivalries).where(and(eq(rivalries.user1Id, u1), eq(rivalries.user2Id, u2))).limit(1);
  if (existing) return existing;
  try {
    await db.insert(rivalries).values({ user1Id: u1, user2Id: u2 });
  } catch { /* duplicate — read again */ }
  const [r] = await db.select().from(rivalries).where(and(eq(rivalries.user1Id, u1), eq(rivalries.user2Id, u2))).limit(1);
  return r;
}

export async function updateRivalry(winnerId: number, loserId: number) {
  const db = await getDb();
  const u1 = Math.min(winnerId, loserId);
  const u2 = Math.max(winnerId, loserId);
  const winnerIsU1 = winnerId === u1;
  await db.update(rivalries).set({
    ...(winnerIsU1 ? { user1Wins: sql`${rivalries.user1Wins} + 1` } : { user2Wins: sql`${rivalries.user2Wins} + 1` }),
    totalGames: sql`${rivalries.totalGames} + 1`,
    lastPlayedAt: new Date(),
  } as any).where(and(eq(rivalries.user1Id, u1), eq(rivalries.user2Id, u2)));
}

export async function getUserRivalries(userId: number) {
  const db = await getDb();
  const rows = await db.select().from(rivalries).where(
    or(eq(rivalries.user1Id, userId), eq(rivalries.user2Id, userId))
  ).orderBy(desc(rivalries.totalGames)).limit(20);
  if (rows.length === 0) return [];
  const opponentIds = rows.map(r => r.user1Id === userId ? r.user2Id : r.user1Id);
  const opponents = await db.select({
    id: users.id, name: users.name, nickname: users.nickname, profilePhotoUrl: users.profilePhotoUrl,
    skillLevel: users.skillLevel,
  }).from(users).where(sql`${users.id} IN (${sql.join(opponentIds.map(id => sql`${id}`), sql`, `)})`);
  const opponentMap = new Map(opponents.map(o => [o.id, o]));
  return rows.map(r => {
    const isUser1 = r.user1Id === userId;
    const opponentId = isUser1 ? r.user2Id : r.user1Id;
    return {
      ...r,
      myWins: isUser1 ? r.user1Wins : r.user2Wins,
      theirWins: isUser1 ? r.user2Wins : r.user1Wins,
      opponent: opponentMap.get(opponentId) ?? null,
    };
  });
}

// =============================================================================
// FAVORITE PLAYERS
// =============================================================================
export async function addFavoritePlayer(userId: number, favoriteId: number) {
  const db = await getDb();
  try {
    await db.insert(favoritePlayers).values({ userId, favoriteId });
  } catch (e: any) {
    if (e.code === "ER_DUP_ENTRY") throw new Error("Already favorited");
    throw e;
  }
  return { success: true };
}

export async function removeFavoritePlayer(userId: number, favoriteId: number) {
  const db = await getDb();
  await db.delete(favoritePlayers).where(and(eq(favoritePlayers.userId, userId), eq(favoritePlayers.favoriteId, favoriteId)));
  return { success: true };
}

export async function getFavoritePlayers(userId: number) {
  const db = await getDb();
  return db.select({
    id: users.id, name: users.name, nickname: users.nickname, profilePhotoUrl: users.profilePhotoUrl,
    skillLevel: users.skillLevel, city: users.city, currentStreak: users.currentStreak,
    level: users.level, isPremium: users.isPremium, totalWins: users.totalWins, totalGames: users.totalGames,
    favoritedAt: favoritePlayers.createdAt,
  }).from(favoritePlayers)
    .innerJoin(users, eq(favoritePlayers.favoriteId, users.id))
    .where(eq(favoritePlayers.userId, userId))
    .orderBy(desc(favoritePlayers.createdAt));
}

export async function isFavoritePlayer(userId: number, favoriteId: number) {
  const db = await getDb();
  const [row] = await db.select({ id: favoritePlayers.id }).from(favoritePlayers)
    .where(and(eq(favoritePlayers.userId, userId), eq(favoritePlayers.favoriteId, favoriteId))).limit(1);
  return !!row;
}

// =============================================================================
// REFERRAL SYSTEM
// =============================================================================
export async function createReferralCode(userId: number) {
  const db = await getDb();
  // Check if user already has an active code
  const [existing] = await db.select().from(referrals)
    .where(and(eq(referrals.referrerId, userId), eq(referrals.status, "pending")))
    .limit(1);
  if (existing) return { code: existing.code };
  const code = `PKL${userId.toString(36).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
  await db.insert(referrals).values({ referrerId: userId, code });
  return { code };
}

export async function redeemReferralCode(userId: number, code: string) {
  const db = await getDb();
  const [ref] = await db.select().from(referrals).where(and(eq(referrals.code, code), eq(referrals.status, "pending"))).limit(1);
  if (!ref) throw new Error("Invalid or expired referral code");
  if (ref.referrerId === userId) throw new Error("Cannot use your own referral code");
  // Check if this user already redeemed a code
  const [alreadyReferred] = await db.select({ id: referrals.id }).from(referrals)
    .where(and(eq(referrals.referredId, userId), eq(referrals.status, "completed"))).limit(1);
  if (alreadyReferred) throw new Error("You've already used a referral code");
  await db.update(referrals).set({ referredId: userId, status: "completed", completedAt: new Date() }).where(eq(referrals.id, ref.id));
  // Award XP to both users: 200 XP to referrer, 100 XP to referred
  await db.update(users).set({ xp: sql`${users.xp} + 200` }).where(eq(users.id, ref.referrerId));
  await db.update(users).set({ xp: sql`${users.xp} + 100` }).where(eq(users.id, userId));
  await db.update(referrals).set({ xpRewarded: true }).where(eq(referrals.id, ref.id));
  return { success: true, referrerXp: 200, referredXp: 100 };
}

export async function getUserReferrals(userId: number) {
  const db = await getDb();
  const refs = await db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
  return refs;
}

// =============================================================================
// KING OF THE COURT (court-specific leaderboard)
// =============================================================================
export async function getCourtLeaderboard(courtId: number) {
  const db = await getDb();
  // Get all games at this court that are completed, then tally wins per user
  const completedGames = await db.select({ id: games.id }).from(games)
    .where(and(eq(games.courtId, courtId), eq(games.status, "completed")));
  if (completedGames.length === 0) return [];
  const gameIds = completedGames.map(g => g.id);
  const results = await db.select().from(gameResults)
    .where(sql`${gameResults.gameId} IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})`);
  // Tally wins per user from team1/team2 player IDs
  const winMap = new Map<number, number>();
  const gameMap = new Map<number, number>();
  for (const result of results) {
    const winnerIds: number[] = result.winnerTeam === "team1"
      ? JSON.parse(result.team1PlayerIds || "[]")
      : result.winnerTeam === "team2"
        ? JSON.parse(result.team2PlayerIds || "[]")
        : [];
    const allIds = [...JSON.parse(result.team1PlayerIds || "[]"), ...JSON.parse(result.team2PlayerIds || "[]")];
    for (const id of allIds) gameMap.set(id, (gameMap.get(id) ?? 0) + 1);
    for (const id of winnerIds) winMap.set(id, (winMap.get(id) ?? 0) + 1);
  }
  // Get user details for top players
  const sortedUserIds = Array.from(gameMap.keys()).sort((a, b) => (winMap.get(b) ?? 0) - (winMap.get(a) ?? 0)).slice(0, 20);
  if (sortedUserIds.length === 0) return [];
  const userRows = await db.select({
    id: users.id, name: users.name, nickname: users.nickname, profilePhotoUrl: users.profilePhotoUrl,
    skillLevel: users.skillLevel,
  }).from(users).where(sql`${users.id} IN (${sql.join(sortedUserIds.map(id => sql`${id}`), sql`, `)})`);
  const userMap = new Map(userRows.map(u => [u.id, u]));
  return sortedUserIds.map((uid, i) => ({
    rank: i + 1,
    user: userMap.get(uid) ?? { id: uid, name: "Unknown", nickname: null, profilePhotoUrl: null, skillLevel: null },
    wins: winMap.get(uid) ?? 0,
    games: gameMap.get(uid) ?? 0,
    winRate: ((winMap.get(uid) ?? 0) / (gameMap.get(uid) ?? 1) * 100).toFixed(0),
  }));
}

// =============================================================================
// FEED POSTS (social posting)
// =============================================================================
export async function createFeedPost(userId: number, data: {
  content: string; photoUrl?: string; postType?: string;
}) {
  const db = await getDb();
  const [inserted] = await db.insert(feedPosts).values({
    userId,
    content: data.content,
    photoUrl: data.photoUrl ?? null,
    postType: (data.postType ?? "general") as any,
  }).$returningId();
  // Also create an activity feed item for this post
  await db.insert(activityFeed).values({
    userId,
    activityType: "user_post" as any,
    title: data.content.slice(0, 100),
    description: data.content.length > 100 ? data.content : undefined,
    targetType: "feed_post",
    targetId: inserted.id,
    isPublic: true,
  });
  return { id: inserted.id };
}

export async function getFeedPosts(userId: number, opts: {
  limit?: number; offset?: number; filter?: string;
}) {
  const db = await getDb();
  const blockedIds = await getBlockedUserIds(userId);
  const blockedCondition = blockedIds.size > 0
    ? sql`${feedPosts.userId} NOT IN (${sql.join(Array.from(blockedIds).map(id => sql`${id}`), sql`, `)})`
    : sql`1=1`;
  const filterCondition = opts.filter && opts.filter !== "all"
    ? eq(feedPosts.postType, opts.filter as any)
    : sql`1=1`;

  const posts = await db.select({
    id: feedPosts.id,
    userId: feedPosts.userId,
    content: feedPosts.content,
    photoUrl: feedPosts.photoUrl,
    postType: feedPosts.postType,
    likesCount: feedPosts.likesCount,
    commentsCount: feedPosts.commentsCount,
    createdAt: feedPosts.createdAt,
    userName: users.name,
    userNickname: users.nickname,
    userPhoto: users.profilePhotoUrl,
    userLevel: users.level,
    userSkillLevel: users.skillLevel,
  }).from(feedPosts)
    .leftJoin(users, eq(feedPosts.userId, users.id))
    .where(and(eq(feedPosts.isPublic, true), blockedCondition, filterCondition))
    .orderBy(desc(feedPosts.createdAt))
    .limit(opts.limit ?? 30)
    .offset(opts.offset ?? 0);

  // Check which posts the current user has liked and bookmarked
  if (posts.length > 0) {
    const postIds = posts.map(p => p.id);
    const postIdSql = sql`${sql.join(postIds.map(id => sql`${id}`), sql`, `)}`;
    const likes = await db.select({ postId: feedLikes.postId }).from(feedLikes)
      .where(and(
        eq(feedLikes.userId, userId),
        sql`${feedLikes.postId} IN (${postIdSql})`
      ));
    const bookmarks = await db.select({ postId: feedBookmarks.postId }).from(feedBookmarks)
      .where(and(
        eq(feedBookmarks.userId, userId),
        sql`${feedBookmarks.postId} IN (${postIdSql})`
      ));
    const reactions = await db.select({ postId: feedReactions.postId, emoji: feedReactions.emoji }).from(feedReactions)
      .where(sql`${feedReactions.postId} IN (${postIdSql})`);
    const likedSet = new Set(likes.map(l => l.postId));
    const bookmarkedSet = new Set(bookmarks.map(b => b.postId));
    // Group reactions by post
    const reactionsByPost: Record<number, Record<string, number>> = {};
    for (const r of reactions) {
      if (!reactionsByPost[r.postId]) reactionsByPost[r.postId] = {};
      reactionsByPost[r.postId][r.emoji] = (reactionsByPost[r.postId][r.emoji] || 0) + 1;
    }
    // Check user's own reactions
    const myReactions = await db.select({ postId: feedReactions.postId, emoji: feedReactions.emoji }).from(feedReactions)
      .where(and(eq(feedReactions.userId, userId), sql`${feedReactions.postId} IN (${postIdSql})`));
    const myReactionsByPost: Record<number, string[]> = {};
    for (const r of myReactions) {
      if (!myReactionsByPost[r.postId]) myReactionsByPost[r.postId] = [];
      myReactionsByPost[r.postId].push(r.emoji);
    }
    return posts.map(p => ({
      ...p,
      isLiked: likedSet.has(p.id),
      isBookmarked: bookmarkedSet.has(p.id),
      reactions: reactionsByPost[p.id] || {},
      myReactions: myReactionsByPost[p.id] || [],
    }));
  }
  return posts.map(p => ({ ...p, isLiked: false, isBookmarked: false, reactions: {}, myReactions: [] }));
}

export async function toggleFeedLike(userId: number, postId: number) {
  const db = await getDb();
  // Check if already liked
  const [existing] = await db.select({ id: feedLikes.id }).from(feedLikes)
    .where(and(eq(feedLikes.postId, postId), eq(feedLikes.userId, userId))).limit(1);
  if (existing) {
    await db.delete(feedLikes).where(eq(feedLikes.id, existing.id));
    await db.update(feedPosts).set({ likesCount: sql`GREATEST(${feedPosts.likesCount} - 1, 0)` }).where(eq(feedPosts.id, postId));
    return { liked: false };
  } else {
    await db.insert(feedLikes).values({ postId, userId });
    await db.update(feedPosts).set({ likesCount: sql`${feedPosts.likesCount} + 1` }).where(eq(feedPosts.id, postId));
    return { liked: true };
  }
}

export async function addFeedComment(userId: number, postId: number, content: string) {
  const db = await getDb();
  const [inserted] = await db.insert(feedComments).values({ postId, userId, content }).$returningId();
  await db.update(feedPosts).set({ commentsCount: sql`${feedPosts.commentsCount} + 1` }).where(eq(feedPosts.id, postId));
  return { id: inserted.id };
}

export async function getFeedComments(postId: number, limit = 50) {
  const db = await getDb();
  return db.select({
    id: feedComments.id,
    postId: feedComments.postId,
    userId: feedComments.userId,
    content: feedComments.content,
    createdAt: feedComments.createdAt,
    userName: users.name,
    userNickname: users.nickname,
    userPhoto: users.profilePhotoUrl,
  }).from(feedComments)
    .leftJoin(users, eq(feedComments.userId, users.id))
    .where(eq(feedComments.postId, postId))
    .orderBy(asc(feedComments.createdAt))
    .limit(limit);
}

export async function deleteFeedPost(userId: number, postId: number) {
  const db = await getDb();
  const [post] = await db.select({ userId: feedPosts.userId }).from(feedPosts).where(eq(feedPosts.id, postId)).limit(1);
  if (!post) throw new Error("Post not found");
  if (post.userId !== userId) throw new Error("Not authorized");
  await db.delete(feedComments).where(eq(feedComments.postId, postId));
  await db.delete(feedLikes).where(eq(feedLikes.postId, postId));
  await db.delete(feedReactions).where(eq(feedReactions.postId, postId));
  await db.delete(feedBookmarks).where(eq(feedBookmarks.postId, postId));
  await db.delete(feedPosts).where(eq(feedPosts.id, postId));
  return { success: true };
}

// ── Feed Reactions ────────────────────────────────────────────────────────
export async function toggleFeedReaction(userId: number, postId: number, emoji: string) {
  const db = await getDb();
  const [existing] = await db.select({ id: feedReactions.id }).from(feedReactions)
    .where(and(eq(feedReactions.postId, postId), eq(feedReactions.userId, userId), eq(feedReactions.emoji, emoji))).limit(1);
  if (existing) {
    await db.delete(feedReactions).where(eq(feedReactions.id, existing.id));
    return { added: false, emoji };
  } else {
    await db.insert(feedReactions).values({ postId, userId, emoji });
    return { added: true, emoji };
  }
}

// ── Feed Bookmarks ────────────────────────────────────────────────────────
export async function toggleFeedBookmark(userId: number, postId: number) {
  const db = await getDb();
  const [existing] = await db.select({ id: feedBookmarks.id }).from(feedBookmarks)
    .where(and(eq(feedBookmarks.postId, postId), eq(feedBookmarks.userId, userId))).limit(1);
  if (existing) {
    await db.delete(feedBookmarks).where(eq(feedBookmarks.id, existing.id));
    return { bookmarked: false };
  } else {
    await db.insert(feedBookmarks).values({ postId, userId });
    return { bookmarked: true };
  }
}

export async function getBookmarkedPosts(userId: number, limit = 30) {
  const db = await getDb();
  const posts = await db.select({
    id: feedPosts.id, userId: feedPosts.userId, content: feedPosts.content,
    photoUrl: feedPosts.photoUrl, postType: feedPosts.postType,
    likesCount: feedPosts.likesCount, commentsCount: feedPosts.commentsCount,
    createdAt: feedPosts.createdAt,
    userName: users.name, userNickname: users.nickname, userPhoto: users.profilePhotoUrl,
    userLevel: users.level, userSkillLevel: users.skillLevel,
    bookmarkedAt: feedBookmarks.createdAt,
  }).from(feedBookmarks)
    .innerJoin(feedPosts, eq(feedBookmarks.postId, feedPosts.id))
    .leftJoin(users, eq(feedPosts.userId, users.id))
    .where(eq(feedBookmarks.userId, userId))
    .orderBy(desc(feedBookmarks.createdAt))
    .limit(limit);
  return posts.map(p => ({ ...p, isLiked: false, isBookmarked: true, reactions: {}, myReactions: [] }));
}

// ── Report Post ───────────────────────────────────────────────────────────
export async function reportFeedPost(userId: number, postId: number, reason: string) {
  const db = await getDb();
  const [post] = await db.select({ userId: feedPosts.userId }).from(feedPosts).where(eq(feedPosts.id, postId)).limit(1);
  if (!post) throw new Error("Post not found");
  // Use reports table (targetType = 'feed_post')
  await db.insert(reports).values({
    reporterId: userId,
    reportedId: post.userId,
    reason: `[Feed Post #${postId}] ${reason}`,
  } as any);
  return { success: true };
}