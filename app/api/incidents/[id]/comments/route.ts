import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({ content: z.string().min(1) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { id } = await params;
  const comments = await prisma.comment.findMany({
    where: { incidentId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return ok(comments);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { id } = await params;
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) return err("Incident introuvable", 404);

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const comment = await prisma.comment.create({
    data: { content: parsed.data.content, incidentId: id, authorId: session.user.id },
    include: { author: { select: { id: true, name: true } } },
  });

  return ok(comment);
}
