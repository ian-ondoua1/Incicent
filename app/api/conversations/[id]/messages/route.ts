import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({ content: z.string().min(1) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { id } = await params;

  const isParticipant = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId: session.user.id, conversationId: id } },
  });
  if (!isParticipant) return err("Accès refusé", 403);

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Marquer comme lus
  await prisma.conversationParticipant.update({
    where: { userId_conversationId: { userId: session.user.id, conversationId: id } },
    data: { lastReadAt: new Date() },
  });

  return ok(messages);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { id } = await params;

  const isParticipant = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId: session.user.id, conversationId: id } },
  });
  if (!isParticipant) return err("Accès refusé", 403);

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const [message, conversation] = await Promise.all([
    prisma.message.create({
      data: { content: parsed.data.content, senderId: session.user.id, conversationId: id },
      include: { sender: { select: { id: true, name: true, role: true } } },
    }),
    prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
      include: { participants: { select: { userId: true } } },
    }),
  ]);

  const recipientIds = conversation.participants
    .map((p) => p.userId)
    .filter((uid) => uid !== session.user.id);

  if (recipientIds.length > 0) {
    const preview = parsed.data.content.length > 120
      ? parsed.data.content.slice(0, 117) + "..."
      : parsed.data.content;

    await prisma.notification.createMany({
      data: recipientIds.map((uid) => ({
        userId: uid,
        type: "COMMENT_ADDED" as const,
        title: `Nouveau message de ${message.sender.name}`,
        message: preview,
        incidentId: conversation.incidentId ?? null,
      })),
    });
  }

  return ok(message);
}
