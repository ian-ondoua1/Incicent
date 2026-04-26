import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const role = session.user.role as Role;

  if (role === Role.ADMIN) {
    // ADMIN sees everyone (USER + SUPPORT)
    const users = await prisma.user.findMany({
      where: { id: { not: session.user.id }, role: { in: [Role.USER, Role.SUPPORT] } },
      select: { id: true, name: true, role: true, agency: { select: { name: true, city: true } } },
      orderBy: { name: "asc" },
    });
    return ok(users);
  }

  if (role === Role.SUPPORT) {
    // SUPPORT sees all USERs and all ADMINs
    const users = await prisma.user.findMany({
      where: { id: { not: session.user.id }, role: { in: [Role.USER, Role.ADMIN] } },
      select: { id: true, name: true, role: true, agency: { select: { name: true, city: true } } },
      orderBy: { name: "asc" },
    });
    return ok(users);
  }

  // USER sees only SUPPORT users of their own agency
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agencyId: true },
  });

  if (!me?.agencyId) return ok([]);

  const users = await prisma.user.findMany({
    where: { role: Role.SUPPORT, agencyId: me.agencyId },
    select: { id: true, name: true, role: true, agency: { select: { name: true, city: true } } },
    orderBy: { name: "asc" },
  });

  return ok(users);
}
