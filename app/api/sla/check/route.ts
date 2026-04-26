import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";

// Route appelée périodiquement pour vérifier les SLA dépassés
export async function POST() {
  const now = new Date();

  const breached = await prisma.incident.updateMany({
    where: {
      slaDeadline: { lte: now },
      slaBreached: false,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    data: { slaBreached: true },
  });

  return ok({ breached: breached.count });
}
