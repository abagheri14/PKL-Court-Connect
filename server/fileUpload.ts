import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadFile } from "./storage";
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

      const ALLOWED_PURPOSES = ["profile", "court", "game", "group", "coaching", "chat", "general"];
      const rawPurpose = (req.body?.purpose as string) || "general";
      const purpose = ALLOWED_PURPOSES.includes(rawPurpose) ? rawPurpose : "general";
      const key = `${purpose}/${req.file.filename}`;
      
      // Try uploading to S3 if configured, otherwise serve from local filesystem
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        await uploadFile(key, fileBuffer, req.file.mimetype || "application/octet-stream");
        // Clean up local file after successful upload
        fs.promises.unlink(req.file.path).catch(() => {});
        res.json({ url: `/api/files/${key}`, key });
      } catch (uploadErr: any) {
        console.warn("[Upload] S3 upload failed, falling back to local storage:", uploadErr?.message);
        // Fallback: serve from local filesystem (file already saved by multer)
        res.json({ url: `/api/files/${req.file.filename}`, key: req.file.filename, fallback: true });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Upload failed" });
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
