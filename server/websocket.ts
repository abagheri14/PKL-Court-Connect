import type { Server as SocketIOServer } from "socket.io";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./_core/sdk";
import * as db from "./db";

// Track online users: openId -> Set of socket IDs
const onlineUsers = new Map<string, Set<string>>();
// Track userId -> openId mapping
const userIdToOpenId = new Map<number, string>();

// WebSocket rate limiting per socket: max 30 messages per 10 seconds
const WS_RATE_LIMIT = 30;
const WS_RATE_WINDOW = 10_000;
const socketRateLimits = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup of expired rate limit entries (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(socketRateLimits.entries())) {
    if (now >= entry.resetAt) socketRateLimits.delete(key);
  }
}, 60_000).unref();

function checkSocketRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = socketRateLimits.get(socketId);
  if (entry && now < entry.resetAt) {
    if (entry.count >= WS_RATE_LIMIT) return false;
    entry.count++;
    return true;
  }
  socketRateLimits.set(socketId, { count: 1, resetAt: now + WS_RATE_WINDOW });
  return true;
}

export function setupSocketIO(io: SocketIOServer) {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return next(new Error("No cookies"));

      const cookies = parseCookieHeader(cookieHeader);
      const sessionCookie = cookies[COOKIE_NAME];
      if (!sessionCookie) return next(new Error("No session cookie"));

      const session = await sdk.verifySession(sessionCookie);
      if (!session) return next(new Error("Invalid session"));

      const user = await db.getUserByOpenId(session.openId);
      if (!user) return next(new Error("User not found"));

      (socket as any).userId = user.id;
      (socket as any).openId = session.openId;
      (socket as any).ghostMode = user.ghostMode ?? false;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId as number;
    const openId = (socket as any).openId as string;
    const ghostMode = (socket as any).ghostMode as boolean;

    // Track online status
    if (!onlineUsers.has(openId)) {
      onlineUsers.set(openId, new Set());
    }
    onlineUsers.get(openId)!.add(socket.id);
    userIdToOpenId.set(userId, openId);

    // Broadcast online status (respect ghost mode)
    if (!ghostMode) {
      io.emit("user:online", { userId });
    }

    // Join user's personal room for targeted messages
    socket.join(`user:${userId}`);

    // ── Chat Messages ──────────────────────────────────────────────────
    socket.on("chat:send", async (data: {
      conversationId: number;
      content?: string;
      messageType?: "text" | "image" | "location_pin" | "system";
      locationLat?: number;
      locationLng?: number;
      locationName?: string;
    }) => {
      try {
        // Runtime validation for WebSocket payloads (TypeScript types are compile-time only)
        if (!data || typeof data.conversationId !== "number" || !Number.isInteger(data.conversationId)) {
          socket.emit("chat:error", { error: "Invalid conversation ID" });
          return;
        }
        // Rate limit WebSocket messages
        if (!checkSocketRateLimit(socket.id)) {
          socket.emit("chat:error", { error: "Too many messages. Please slow down." });
          return;
        }
        // Verify participant before allowing message send
        const isParticipant = await db.isConversationParticipant(userId, data.conversationId);
        if (!isParticipant) {
          socket.emit("chat:error", { error: "Not a participant in this conversation" });
          return;
        }
        // Sanitize content - strip HTML tags and limit length
        const sanitizedContent = data.content?.replace(/<[^>]*>/g, "").trim().slice(0, 5000);
        if (!sanitizedContent && data.messageType !== "location_pin" && data.messageType !== "image") {
          socket.emit("chat:error", { error: "Message content is required" });
          return;
        }
        const message = await db.sendMessage(userId, {
          conversationId: data.conversationId,
          content: sanitizedContent,
          messageType: data.messageType || "text",
          locationLat: data.locationLat,
          locationLng: data.locationLng,
          locationName: data.locationName?.replace(/<[^>]*>/g, "").trim().slice(0, 255),
        });

        // Emit to all participants in the conversation
        io.to(`conversation:${data.conversationId}`).emit("chat:message", {
          ...(message || {}),
          conversationId: data.conversationId,
          content: sanitizedContent,
          messageType: data.messageType || "text",
          senderId: userId,
        });
      } catch (err) {
        socket.emit("chat:error", { error: "Failed to send message" });
      }
    });

    // Join conversation room — verify participant first
    socket.on("chat:join", async (conversationId: number) => {
      if (typeof conversationId !== "number" || !Number.isInteger(conversationId)) return;
      const isParticipant = await db.isConversationParticipant(userId, conversationId);
      if (isParticipant) {
        socket.join(`conversation:${conversationId}`);
      } else {
        socket.emit("chat:error", { error: "Not a participant in this conversation" });
      }
    });

    // Leave conversation room
    socket.on("chat:leave", (conversationId: number) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators — verify room membership
    socket.on("chat:typing", async (data: { conversationId: number; isTyping: boolean }) => {
      if (!checkSocketRateLimit(socket.id)) return;
      const isParticipant = await db.isConversationParticipant(userId, data.conversationId);
      if (!isParticipant) return;
      socket.to(`conversation:${data.conversationId}`).emit("chat:typing", {
        userId,
        conversationId: data.conversationId,
        isTyping: data.isTyping,
      });
    });

    // Read receipts — verify participant
    socket.on("chat:read", async (data: { conversationId: number }) => {
      const isParticipant = await db.isConversationParticipant(userId, data.conversationId);
      if (!isParticipant) return;
      await db.markConversationRead(userId, data.conversationId);
      io.to(`conversation:${data.conversationId}`).emit("chat:read", {
        userId,
        conversationId: data.conversationId,
      });
    });

    // ── Game Events ────────────────────────────────────────────────────
    socket.on("game:join", async (gameId: number) => {
      if (typeof gameId !== "number" || !Number.isInteger(gameId)) return;
      const isParticipant = await db.isGameParticipant(userId, gameId);
      if (!isParticipant) return;
      socket.join(`game:${gameId}`);
    });

    socket.on("game:update", async (data: { gameId: number; update: { field: string; value: string | number | boolean } }) => {
      if (!data || typeof data.gameId !== "number" || !Number.isInteger(data.gameId)) return;
      if (!data.update || typeof data.update.field !== "string") return;
      if (!checkSocketRateLimit(socket.id)) return;
      // Validate the caller is a participant
      const isParticipant = await db.isGameParticipant(userId, data.gameId);
      if (!isParticipant) return;
      // Whitelist allowed fields
      const ALLOWED_FIELDS = ["notes", "currentRound"];
      if (!ALLOWED_FIELDS.includes(data.update?.field)) return;
      // Sanitize string values before broadcasting
      const sanitizedValue = typeof data.update.value === "string"
        ? data.update.value.replace(/<[^>]*>/g, "").trim().slice(0, 5000)
        : data.update.value;
      io.to(`game:${data.gameId}`).emit("game:updated", {
        ...data,
        update: { field: data.update.field, value: sanitizedValue },
      });
    });

    // Real-time score sync — broadcast to other players in the game room
    socket.on("game:scoreUpdate", async (data: { gameId: number; team1Score: number; team2Score: number; currentRound: number; servingTeam: 1 | 2; updatedBy: number }) => {
      if (!data || typeof data.gameId !== "number" || !Number.isInteger(data.gameId)) return;
      if (typeof data.team1Score !== "number" || typeof data.team2Score !== "number") return;
      if (typeof data.currentRound !== "number" || typeof data.updatedBy !== "number") return;
      if (!checkSocketRateLimit(socket.id)) return;
      // Validate the caller is a participant and the updatedBy matches the socket user
      if (data.updatedBy !== userId) return;
      const isParticipant = await db.isGameParticipant(userId, data.gameId);
      if (!isParticipant) return;
      // Validate score values are reasonable
      if (data.team1Score < 0 || data.team1Score > 99 || data.team2Score < 0 || data.team2Score > 99) return;
      if (data.currentRound < 1 || data.currentRound > 10) return;
      if (data.servingTeam !== 1 && data.servingTeam !== 2) return;
      socket.to(`game:${data.gameId}`).emit("game:scoreUpdate", data);
    });

    // ── Notifications ──────────────────────────────────────────────────
    socket.on("notification:subscribe", () => {
      // Already in personal room via user:{userId}
    });

    // ── Disconnect ─────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      socketRateLimits.delete(socket.id);
      const sockets = onlineUsers.get(openId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(openId);
          userIdToOpenId.delete(userId);
          if (!ghostMode) {
            io.emit("user:offline", { userId });
          }
        }
      }
    });
  });

  // Expose a function to send notifications from server-side code
  (global as any).__socketIO = io;
}

/** Send a real-time notification to a specific user */
export function sendRealtimeNotification(userId: number, notification: any) {
  const io = (global as any).__socketIO as SocketIOServer | undefined;
  if (io) {
    io.to(`user:${userId}`).emit("notification", notification);
  }
}

/** Broadcast an event to all sockets in a game room */
export function broadcastToGameRoom(gameId: number, event: string, data: any) {
  const io = (global as any).__socketIO as SocketIOServer | undefined;
  if (io) {
    io.to(`game:${gameId}`).emit(event, data);
  }
}
