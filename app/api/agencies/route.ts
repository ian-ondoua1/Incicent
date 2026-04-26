import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
});

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const agencies = await prisma.agency.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, incidents: true } } },
  });

  return ok(agencies);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SUPPORT) {
    return err("Accès refusé", 403);
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const exists = await prisma.agency.findFirst({ where: { name: parsed.data.name } });
  if (exists) return err("Une agence avec ce nom existe déjà", 409);

  const agency = await prisma.agency.create({ data: parsed.data });
  return ok(agency);
}
