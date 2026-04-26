import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Role } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const role = session.user.role as Role;
  const isAdmin = role === Role.ADMIN;
  const isPrivileged = isAdmin || role === Role.SUPPORT;

  // USER : incidents de son agence ; SUPPORT/ADMIN : tout
  let where: { agencyId?: string } = {};
  let myAgency: { id: string; name: string; city: string } | null = null;

  if (!isPrivileged) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { agency: { select: { id: true, name: true, city: true } } },
    });
    myAgency = me?.agency ?? null;
    if (!myAgency) {
      return ok({ role, total: 0, byStatus: {}, byPriority: {}, recent: [], myAgency: null });
    }
    where = { agencyId: myAgency.id };
  }

  const [total, byStatus, byPriority, recent, resolved, agencyGroups, slaBreached] = await Promise.all([
    prisma.incident.count({ where }),

    prisma.incident.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),

    prisma.incident.groupBy({
      by: ["priority"],
      where,
      _count: { _all: true },
    }),

    prisma.incident.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        creator: { select: { id: true, name: true } },
        agency: { select: { name: true, city: true } },
      },
    }),

    prisma.incident.findMany({
      where: { ...where, status: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 100,
    }),

    isPrivileged
      ? prisma.incident.groupBy({
          by: ["agencyId"],
          where,
          _count: { _all: true },
          orderBy: { _count: { agencyId: "desc" } },
          take: 10,
        })
      : Promise.resolve([]),

    prisma.incident.count({
      where: { ...where, slaBreached: true, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
  ]);

  // MTTR en minutes
  const mttr =
    resolved.length === 0
      ? null
      : Math.round(
          resolved.reduce((acc, inc) => {
            return acc + (inc.resolvedAt!.getTime() - inc.createdAt.getTime()) / 60000;
          }, 0) / resolved.length
        );

  // Résoudre les noms d'agences
  const agencyIds = (agencyGroups as { agencyId: string }[]).map((a) => a.agencyId);
  const agencyNames =
    agencyIds.length > 0
      ? await prisma.agency.findMany({
          where: { id: { in: agencyIds } },
          select: { id: true, name: true, city: true },
        })
      : [];

  const byAgency = (agencyGroups as { agencyId: string; _count: { _all: number } }[]).map((a) => {
    const ag = agencyNames.find((n) => n.id === a.agencyId);
    return {
      name: ag?.name ?? a.agencyId,
      city: ag?.city ?? "",
      count: a._count._all,
    };
  });

  // Stats admin uniquement
  let usersByRole: Record<string, number> = {};
  let agenciesCount = 0;
  if (isAdmin) {
    const [usersGroup, agencies] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.agency.count(),
    ]);
    usersByRole = Object.fromEntries(usersGroup.map((u) => [u.role, u._count._all]));
    agenciesCount = agencies;
  }

  return ok({
    role,
    myAgency,
    total,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, p._count._all])),
    recent,
    mttr,
    byAgency,
    slaBreached,
    usersByRole,
    agenciesCount,
  });
}
