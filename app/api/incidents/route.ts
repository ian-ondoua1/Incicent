import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { sendIncidentCreatedEmail } from "@/lib/mailer";
import { z } from "zod";
import { Priority, Role } from "@prisma/client";

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  priority: z.nativeEnum(Priority).optional(),
  category: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  agencyId: z.string().optional(),
});

const agencyInclude = { id: true, name: true, city: true };

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const status = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const agencyId = searchParams.get("agencyId") ?? undefined;

  // USER voit uniquement les incidents de son agence
  let userAgencyId: string | undefined;
  if (session.user.role === Role.USER) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { agencyId: true } });
    userAgencyId = user?.agencyId ?? undefined;
  }

  const where = {
    ...(session.user.role === Role.USER ? { agencyId: userAgencyId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(priority ? { priority: priority as never } : {}),
    ...(agencyId && session.user.role !== Role.USER ? { agencyId } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, incidents] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        agency: { select: agencyInclude },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return ok(incidents, { total, page, limit, pages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role === Role.SUPPORT) return err("Le Support ne peut pas créer d'incident", 403);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  // Résolution de l'agence : agencyId fourni (admin) ou agence de l'utilisateur
  let agencyId = parsed.data.agencyId;
  if (!agencyId) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { agencyId: true } });
    agencyId = user?.agencyId ?? undefined;
  }
  if (!agencyId) return err("Aucune agence associée. Sélectionnez une agence.", 422);

  // Calcul deadline SLA
  const priority = parsed.data.priority ?? "MEDIUM";
  const slaConfig = await prisma.slaConfig.findUnique({ where: { priority } });
  const slaDeadline = slaConfig
    ? new Date(Date.now() + slaConfig.resolutionTime * 60 * 1000)
    : null;

  const { agencyId: _a, ...rest } = parsed.data;
  const incident = await prisma.incident.create({
    data: {
      ...rest,
      dueAt: rest.dueAt ? new Date(rest.dueAt) : undefined,
      creatorId: session.user.id,
      agencyId,
      slaDeadline,
    },
    include: {
      creator: { select: { id: true, name: true } },
      agency: { select: agencyInclude },
    },
  });

  await prisma.auditLog.create({
    data: { action: "CREATED", newValue: incident.status, incidentId: incident.id, userId: session.user.id },
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR");
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const agenceLabel = `${incident.agency.name} — ${incident.agency.city}`;

  // Notifier ADMIN + SUPPORT (sauf le créateur lui-même)
  const privileged = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPPORT"] }, id: { not: session.user.id } },
    select: { id: true, email: true, role: true },
  });

  if (privileged.length > 0) {
    await prisma.notification.createMany({
      data: privileged.map((u) => ({
        type: "INCIDENT_CREATED" as const,
        userId: u.id,
        title: `Nouvel incident — ${incident.priority}`,
        message: `"${incident.title}" signalé par ${incident.creator.name} · ${agenceLabel} · ${dateStr} à ${timeStr}`,
        incidentId: incident.id,
      })),
    });

    sendIncidentCreatedEmail({
      to: privileged.map((u) => u.email),
      incidentId: incident.id,
      title: incident.title,
      priority: incident.priority,
      agency: agenceLabel,
      createdBy: incident.creator.name,
    }).catch(() => {});
  }

  return ok(incident);
}
