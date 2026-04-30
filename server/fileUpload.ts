import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getSignedUrl, uploadFile } from "./storage";
import { getUploadedFile, saveUploadedFile } from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
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

const ALLOWED_PURPOSES = [
  "profile-photo",
  "chat-image",
  "court-photo",
  "profile",
  "court",
  "game",
  "group",
  "coaching",
  "chat",
  "general",
];

function normalizeFileKey(value: string): string | null {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some(part => part === "." || part === ".." || part.startsWith("."))) return null;
  return parts.join("/");
}

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

      const rawPurpose = (req.body?.purpose as string) || "general";
      const purpose = ALLOWED_PURPOSES.includes(rawPurpose) ? rawPurpose : "general";
      const userId = (req as any).userId as number | undefined;
      if (!userId) {
        fs.promises.unlink(req.file.path).catch(() => {});
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const key = `${purpose}/${userId}/${req.file.filename}`;
      const fileBuffer = await fs.promises.readFile(req.file.path);
      let storageBackend: "remote+database" | "database" = "database";

      try {
        await uploadFile(key, fileBuffer, req.file.mimetype || "application/octet-stream");
        storageBackend = "remote+database";
      } catch (uploadErr: any) {
        console.warn("[Upload] Remote storage unavailable; saving durable database copy:", uploadErr?.message);
      } finally {
        fs.promises.unlink(req.file.path).catch(() => {});
      }

      await saveUploadedFile(userId, key, req.file.mimetype || "application/octet-stream", fileBuffer);

      res.json({ url: `/api/files/${key}`, key, storage: storageBackend });
    } catch (err: any) {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Serve uploaded files (authenticated)
  app.get("/api/files/:filename(*)", requireAuth, async (req: Request, res: Response) => {
    const requestedPath = normalizeFileKey(req.params.filename);
    if (!requestedPath) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const filePath = path.resolve(UPLOAD_DIR, ...requestedPath.split("/"));
    // Ensure resolved path stays within UPLOAD_DIR
    const relativePath = path.relative(UPLOAD_DIR, filePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
      return;
    }

    const storedFile = await getUploadedFile(requestedPath);
    if (storedFile) {
      res.setHeader("Content-Type", storedFile.mimeType);
      res.setHeader("Content-Length", String(storedFile.data.length));
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.send(storedFile.data);
      return;
    }

    try {
      const signedUrl = await getSignedUrl(requestedPath);
      res.redirect(302, signedUrl);
    } catch {
      res.status(404).json({ error: "File not found" });
    }
  });
}
