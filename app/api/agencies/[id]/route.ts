import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const { id } = await params;
  const agency = await prisma.agency.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { incidents: true } },
    },
  });
  if (!agency) return err("Agence introuvable", 404);

  return ok(agency);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SUPPORT) {
    return err("Accès refusé", 403);
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const agency = await prisma.agency.findUnique({ where: { id } });
  if (!agency) return err("Agence introuvable", 404);

  const updated = await prisma.agency.update({ where: { id }, data: parsed.data });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SUPPORT) {
    return err("Accès refusé", 403);
  }

  const { id } = await params;
  const agency = await prisma.agency.findUnique({
    where: { id },
    include: { _count: { select: { incidents: true, users: true } } },
  });
  if (!agency) return err("Agence introuvable", 404);

  if (agency._count.incidents > 0 || agency._count.users > 0) {
    return err("Impossible de supprimer une agence ayant des utilisateurs ou incidents liés", 409);
  }

  await prisma.agency.delete({ where: { id } });
  return ok({ deleted: true });
}
