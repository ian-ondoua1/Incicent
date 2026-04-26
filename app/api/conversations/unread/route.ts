import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: session.user.id },
    select: { conversationId: true, lastReadAt: true },
  });

  const counts = await Promise.all(
    participants.map((p) =>
      prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: session.user.id },
          createdAt: { gt: p.lastReadAt ?? new Date(0) },
        },
      })
    )
  );

  return ok({ total: counts.reduce((a, b) => a + b, 0) });
}
