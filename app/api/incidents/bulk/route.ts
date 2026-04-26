import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Role, Status } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(["status", "assign", "delete"]),
  value: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role === Role.USER) return err("Accès refusé", 403);

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const { ids, action, value } = parsed.data;

  if (action === "status") {
    if (!value) return err("Statut manquant");
    const newStatus = value as Status;
    if (newStatus === "RESOLVED") {
      await prisma.incident.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus, resolvedAt: new Date() },
      });
    } else if (newStatus === "CLOSED") {
      await prisma.incident.updateMany({
        where: { id: { in: ids }, resolvedAt: null },
        data: { status: newStatus, resolvedAt: new Date() },
      });
      await prisma.incident.updateMany({
        where: { id: { in: ids }, resolvedAt: { not: null } },
        data: { status: newStatus },
      });
    } else {
      await prisma.incident.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus },
      });
    }
    return ok({ updated: ids.length });
  }

  if (action === "assign") {
    await prisma.incident.updateMany({
      where: { id: { in: ids } },
      data: { assigneeId: value ?? null },
    });
    return ok({ updated: ids.length });
  }

  if (action === "delete") {
    if (session.user.role !== Role.ADMIN) return err("Accès refusé", 403);
    await prisma.incident.deleteMany({ where: { id: { in: ids } } });
    return ok({ deleted: ids.length });
  }

  return err("Action inconnue");
}
