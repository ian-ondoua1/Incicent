import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? undefined;
  const onlyUnread = searchParams.get("unread") === "true";

  const where = {
    userId: session.user.id,
    ...(type ? { type: type as never } : {}),
    ...(onlyUnread ? { read: false } : {}),
  };

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, read: false },
    }),
  ]);

  return ok({ notifications, unread });
}
