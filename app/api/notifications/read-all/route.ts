import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function PATCH() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return ok({ done: true });
}
