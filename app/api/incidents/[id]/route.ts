import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { sendStatusChangedEmail } from "@/lib/mailer";
import { z } from "zod";
import { Priority, Role, Status } from "@prisma/client";

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  status: z.nativeEnum(Status).optional(),
  priority: z.nativeEnum(Priority).optional(),
  category: z.string().optional(),
  assigneeId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
});

async function getIncident(id: string) {
  return prisma.incident.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      agency: { select: { id: true, name: true, city: true } },
      attachments: true,
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      auditLogs: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { id } = await params;
  const incident = await getIncident(id);
  if (!incident) return err("Incident introuvable", 404);

  if (session.user.role === Role.USER && incident.creatorId !== session.user.id) {
    return err("Accès refusé", 403);
  }

  return ok(incident);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { id } = await params;
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) return err("Incident introuvable", 404);

  if (session.user.role === Role.USER) return err("Accès refusé", 403);

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const oldStatus = incident.status;

  let resolvedAt: Date | undefined | null = undefined;
  if (parsed.data.status === "RESOLVED") {
    resolvedAt = new Date();
  } else if (parsed.data.status === "CLOSED" && !incident.resolvedAt) {
    resolvedAt = new Date();
  }

  const updated = await prisma.incident.update({
    where: { id },
    data: {
      ...parsed.data,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      resolvedAt,
    },
  });

  if (parsed.data.status && parsed.data.status !== oldStatus) {
    await prisma.auditLog.create({
      data: {
        action: "STATUS_CHANGED",
        oldValue: oldStatus,
        newValue: parsed.data.status,
        incidentId: id,
        userId: session.user.id,
      },
    });

    const now = new Date();
    const dateStr = `${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

    const [creatorUser, admins, changer] = await Promise.all([
      prisma.user.findUnique({ where: { id: incident.creatorId }, select: { id: true, email: true } }),
      prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true } }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
    ]);

    const changerName = changer?.name ?? "Système";

    // Notification au créateur
    if (creatorUser && creatorUser.id !== session.user.id) {
      await prisma.notification.create({
        data: {
          type: "STATUS_CHANGED",
          userId: creatorUser.id,
          title: `Incident mis à jour — ${parsed.data.status.replace("_", " ")}`,
          message: `"${incident.title}" est passé de ${oldStatus} → ${parsed.data.status} par ${changerName} · ${dateStr}`,
          incidentId: id,
        },
      });
    }

    // Notification aux admins (sauf celui qui a changé)
    const adminsToNotify = admins.filter((a) => a.id !== session.user.id);
    if (adminsToNotify.length > 0) {
      await prisma.notification.createMany({
        data: adminsToNotify.map((a) => ({
          type: "STATUS_CHANGED" as const,
          userId: a.id,
          title: `Statut modifié — ${incident.title}`,
          message: `${oldStatus} → ${parsed.data.status} par ${changerName} · ${dateStr}`,
          incidentId: id,
        })),
      });
    }

    const emails = [...new Set([creatorUser?.email, ...admins.map((a) => a.email)].filter(Boolean))] as string[];
    sendStatusChangedEmail({
      to: emails, incidentId: id, title: incident.title,
      oldStatus, newStatus: parsed.data.status, changedBy: changerName,
    }).catch(() => {});
  }

  return ok(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role !== Role.ADMIN) return err("Accès refusé", 403);

  const { id } = await params;
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) return err("Incident introuvable", 404);

  await prisma.incident.delete({ where: { id } });
  return ok({ deleted: true });
}
