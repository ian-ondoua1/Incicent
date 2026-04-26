import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agency: { select: { id: true, name: true, city: true } } },
  });

  return ok(user?.agency ?? null);
}
