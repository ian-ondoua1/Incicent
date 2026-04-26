import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({ assigneeId: z.string().nullable() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role !== Role.ADMIN) return err("Accès refusé", 403);

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const updated = await prisma.incident.update({
    where: { id },
    data: { assigneeId: parsed.data.assigneeId },
  });

  await prisma.auditLog.create({
    data: {
      action: "ASSIGNED",
      newValue: parsed.data.assigneeId ?? "unassigned",
      incidentId: id,
      userId: session.user.id,
    },
  });

  return ok(updated);
}
