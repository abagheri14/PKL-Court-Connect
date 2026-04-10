import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Server as SocketIOServer } from "socket.io";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupSocketIO } from "../websocket";
import { setupStripeWebhook } from "../stripeWebhook";
import { setupFileUpload } from "../fileUpload";
import { seedAchievements, seedCourts, seedTestAccounts, ensureSchema } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Stripe webhook must be before body parsers (needs raw body)
  setupStripeWebhook(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // File upload endpoint
  setupFileUpload(app);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Socket.io for real-time features
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? (process.env.CORS_ORIGIN || false)
        : "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });
  setupSocketIO(io);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production (e.g. Render), always use the assigned PORT — never scan
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort && process.env.NODE_ENV !== "production") {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Bind port FIRST so Render/PaaS detects it, then run schema + seeds
  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Ensure DB schema is up-to-date
    try {
      await ensureSchema();
      console.log("[Schema] Database schema verified.");
    } catch (err) {
      console.error("[Schema] Migration failed:", err);
    }

    // Seed data (idempotent)
    seedAchievements().catch(err => console.error("[Achievements] Seed failed:", err));
    seedCourts().catch(err => console.error("[Courts] Seed failed:", err));
    if (process.env.NODE_ENV !== "production") {
      seedTestAccounts().catch(err => console.error("[TestAccounts] Seed failed:", err));
    }
  });
}

startServer().catch(console.error);
