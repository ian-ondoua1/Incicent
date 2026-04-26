import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const now = new Date();

  const agencies = await prisma.agency.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      createdAt: true,
      _count: { select: { users: true, incidents: true } },
      incidents: {
        select: { status: true, slaDeadline: true },
      },
    },
  });

  const enriched = agencies.map((a) => {
    const open = a.incidents.filter((i) => i.status === "OPEN").length;
    const inProgress = a.incidents.filter((i) => i.status === "IN_PROGRESS").length;
    const resolved = a.incidents.filter((i) => i.status === "RESOLVED" || i.status === "CLOSED").length;
    const slaBreached = a.incidents.filter(
      (i) =>
        (i.status === "OPEN" || i.status === "IN_PROGRESS") &&
        i.slaDeadline !== null &&
        i.slaDeadline < now,
    ).length;

    let health: "healthy" | "warning" | "critical";
    if (slaBreached >= 3) health = "critical";
    else if (slaBreached > 0 || open > 5) health = "warning";
    else health = "healthy";

    return {
      id: a.id,
      name: a.name,
      city: a.city,
      createdAt: a.createdAt,
      usersCount: a._count.users,
      incidentsTotal: a._count.incidents,
      open,
      inProgress,
      resolved,
      slaBreached,
      health,
    };
  });

  return ok(enriched);
}
