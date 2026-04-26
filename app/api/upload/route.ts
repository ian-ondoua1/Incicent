import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-msvideo": "avi",
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const incidentId = formData.get("incidentId") as string | null;

  if (!file) return err("Aucun fichier fourni");
  if (!incidentId) return err("incidentId manquant");

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return err("Type de fichier non autorisé. Formats acceptés : JPG, PNG, GIF, WEBP, MP4, MOV, WEBM, AVI");

  const isVideo = file.type.startsWith("video/");
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return err(`Fichier trop volumineux (max ${isVideo ? "100 MB" : "10 MB"})`);
  }

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) return err("Incident introuvable", 404);

  const filename = `${crypto.randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

  const attachment = await prisma.attachment.create({
    data: {
      filename: file.name,
      url: `/uploads/${filename}`,
      size: file.size,
      mimeType: file.type,
      incidentId,
    },
  });

  return ok(attachment);
}
