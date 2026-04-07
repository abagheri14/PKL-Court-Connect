import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists (for serving legacy files)
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Use memory storage — files never touch disk, converted to base64 data URLs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * File upload endpoint.
 * POST /api/upload - Upload an image file
 * Returns: { url: string, key: string }
 */
export function setupFileUpload(app: Express) {
  // Authentication middleware for upload routes
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cookies = parseCookieHeader(req.headers.cookie || "");
      const sessionCookie = cookies[COOKIE_NAME];
      if (!sessionCookie) { res.status(401).json({ error: "Unauthorized" }); return; }
      const session = await sdk.verifySession(sessionCookie);
      if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }
      (req as any).openId = session.openId;
      // Also resolve userId for downstream use
      const { getUserByOpenId } = await import("./db");
      const user = await getUserByOpenId(session.openId);
      if (user) (req as any).userId = user.id;
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  app.post("/api/upload", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      // Convert buffer to base64 data URL — persists in DB, survives redeploys
      const mimeType = req.file.mimetype || "image/jpeg";
      const base64 = req.file.buffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64}`;

      res.json({ url: dataUrl, key: `inline-${Date.now()}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  });

  // Serve uploaded files (authenticated)
  app.get("/api/files/:filename(*)", requireAuth, (req: Request, res: Response) => {
    // Prevent directory traversal - normalize path and validate
    const requestedPath = path.normalize(req.params.filename).replace(/^(\.\.(\/|\\|$))+/, '');
    if (!requestedPath || requestedPath.startsWith('.')) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const filePath = path.resolve(UPLOAD_DIR, requestedPath);
    // Ensure resolved path stays within UPLOAD_DIR
    if (!filePath.startsWith(UPLOAD_DIR)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });
}
