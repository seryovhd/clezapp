import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import ffmpegPath from "ffmpeg-static";
import uploadConfig from "../config/upload";
import { logger } from "../utils/logger";

const SUPPORTED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm"
]);

/**
 * Genera y sirve miniaturas de baja calidad y peso ultra-liviano (10 KB - 30 KB)
 * para imágenes, stickers, videos y GIFs solicitados con el parámetro ?thumb=1
 */
export const handleMediaThumbnail = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const rawUrlPath = req.path;
    const decodedPath = decodeURIComponent(rawUrlPath);
    const originalFilePath = path.join(uploadConfig.directory, decodedPath);

    const ext = path.extname(originalFilePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return next();
    }

    if (!fs.existsSync(originalFilePath)) {
      return next();
    }

    const dirName = path.dirname(originalFilePath);
    const baseName = path.basename(originalFilePath, ext);
    const thumbDir = path.join(dirName, ".thumbnails");
    const thumbFilePath = path.join(thumbDir, `thumb_${baseName}.jpg`);

    // Si la miniatura ya existe en disco, servirla de inmediato con caché
    if (fs.existsSync(thumbFilePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", "image/jpeg");
      res.sendFile(thumbFilePath);
      return;
    }

    // Crear la carpeta .thumbnails si no existe
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    const isVideo = [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext);

    let ffmpegCmd: string;

    if (isVideo) {
      // Para videos: capturar un fotograma nítido en el segundo 0.5 y escalar a 320px
      ffmpegCmd = `"${ffmpegPath}" -y -ss 00:00:00.500 -i "${originalFilePath}" -frames:v 1 -vf "scale=320:-1" -q:v 55 "${thumbFilePath}"`;
    } else {
      // Para imágenes, stickers y GIFs: escalar a 280px con compresión JPEG ligera (~12 KB)
      ffmpegCmd = `"${ffmpegPath}" -y -i "${originalFilePath}" -frames:v 1 -vf "scale=280:-1" -q:v 55 "${thumbFilePath}"`;
    }

    exec(ffmpegCmd, (err) => {
      if (err) {
        // En caso de que el fotograma en 0.5s falle para videos ultra-cortos, intentar en 0s
        if (isVideo) {
          const fallbackCmd = `"${ffmpegPath}" -y -ss 00:00:00 -i "${originalFilePath}" -frames:v 1 -vf "scale=320:-1" -q:v 55 "${thumbFilePath}"`;
          exec(fallbackCmd, (fbErr) => {
            if (!fbErr && fs.existsSync(thumbFilePath)) {
              res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
              res.setHeader("Content-Type", "image/jpeg");
              res.sendFile(thumbFilePath);
              return;
            }
            return next();
          });
          return;
        }

        logger.warn(`[ThumbnailHelper] Error generating thumb for ${originalFilePath}: ${err.message}`);
        return next();
      }

      if (fs.existsSync(thumbFilePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Content-Type", "image/jpeg");
        res.sendFile(thumbFilePath);
      } else {
        return next();
      }
    });
  } catch (error) {
    logger.error("[ThumbnailHelper] Error inesperado:", error);
    return next();
  }
};
