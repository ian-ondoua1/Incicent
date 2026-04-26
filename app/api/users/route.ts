import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role).default(Role.USER),
  agencyId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role !== Role.ADMIN) return err("Accès refusé", 403);

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      agency: { select: { id: true, name: true, city: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(users);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role !== Role.ADMIN) return err("Accès refusé", 403);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return err("Cet email est déjà utilisé", 409);

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashed,
      role: parsed.data.role,
      agencyId: parsed.data.agencyId ?? null,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return ok(user);
}
