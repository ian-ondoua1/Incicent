import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  recipientId: z.string(),
  subject: z.string().optional(),
  incidentId: z.string().optional(),
  firstMessage: z.string().min(1),
});

const participantInclude = {
  user: { select: { id: true, name: true, role: true, agency: { select: { name: true } } } },
};

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: { include: participantInclude },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Calculer les non-lus par conversation
  const withUnread = await Promise.all(
    conversations.map(async (conv) => {
      const participant = conv.participants.find((p) => p.userId === session.user.id);
      const unread = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: session.user.id },
          createdAt: { gt: participant?.lastReadAt ?? new Date(0) },
        },
      });
      return { ...conv, unread };
    })
  );

  return ok(withUnread);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const { recipientId, subject, incidentId, firstMessage } = parsed.data;

  // Vérifier que l'expéditeur a le droit de contacter le destinataire
  const [recipient, sender] = await Promise.all([
    prisma.user.findUnique({ where: { id: recipientId } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, agencyId: true } }),
  ]);
  if (!recipient) return err("Destinataire introuvable", 404);

  const senderRole = session.user.role as Role;

  if (senderRole === Role.USER) {
    // USER ne peut contacter que le SUPPORT de sa propre agence
    if (recipient.role !== Role.SUPPORT) {
      return err("Vous ne pouvez contacter que le Support de votre agence", 403);
    }
    if (!sender?.agencyId || recipient.agencyId !== sender.agencyId) {
      return err("Vous ne pouvez contacter que le Support de votre agence", 403);
    }
  }

  if (senderRole === Role.SUPPORT && recipient.role === Role.SUPPORT) {
    return err("Le Support ne peut pas contacter un autre agent Support", 403);
  }

  // Vérifier si une conversation entre ces deux personnes sur ce ticket existe déjà
  const existing = await prisma.conversation.findFirst({
    where: {
      incidentId: incidentId ?? null,
      participants: { every: { userId: { in: [session.user.id, recipientId] } } },
      AND: [
        { participants: { some: { userId: session.user.id } } },
        { participants: { some: { userId: recipientId } } },
      ],
    },
    include: { participants: { include: participantInclude }, messages: { take: 1 } },
  });

  if (existing) return ok(existing);

  const conv = await prisma.conversation.create({
    data: {
      subject: subject ?? null,
      incidentId: incidentId ?? null,
      participants: {
        create: [
          { userId: session.user.id },
          { userId: recipientId },
        ],
      },
      messages: {
        create: {
          content: firstMessage,
          senderId: session.user.id,
        },
      },
    },
    include: {
      participants: { include: participantInclude },
      messages: { include: { sender: { select: { id: true, name: true } } } },
    },
  });

  const senderName = conv.participants.find((p) => p.userId === session.user.id)?.user.name ?? "Utilisateur";
  const preview = firstMessage.length > 120 ? firstMessage.slice(0, 117) + "..." : firstMessage;

  await prisma.notification.create({
    data: {
      userId: recipientId,
      type: "COMMENT_ADDED",
      title: `Nouveau message de ${senderName}`,
      message: preview,
      incidentId: incidentId ?? null,
    },
  });

  return ok(conv);
}
