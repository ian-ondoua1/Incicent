import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { Priority, Role } from "@prisma/client";
import { z } from "zod";

const schema = z.array(z.object({
  priority: z.nativeEnum(Priority),
  responseTime: z.number().min(1),
  resolutionTime: z.number().min(1),
}));

export async function GET() {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);

  const configs = await prisma.slaConfig.findMany({ orderBy: { priority: "asc" } });

  // Si pas encore configuré, retourner les defaults
  if (configs.length === 0) {
    return ok([
      { priority: "LOW",      responseTime: 480, resolutionTime: 2880 },
      { priority: "MEDIUM",   responseTime: 240, resolutionTime: 1440 },
      { priority: "HIGH",     responseTime: 60,  resolutionTime: 480  },
      { priority: "CRITICAL", responseTime: 15,  resolutionTime: 120  },
    ]);
  }

  return ok(configs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return err("Non autorisé", 401);
  if (session.user.role !== Role.ADMIN) return err("Accès refusé", 403);

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  // Upsert chaque config
  await Promise.all(parsed.data.map((c) =>
    prisma.slaConfig.upsert({
      where: { priority: c.priority },
      update: { responseTime: c.responseTime, resolutionTime: c.resolutionTime },
      create: { priority: c.priority, responseTime: c.responseTime, resolutionTime: c.resolutionTime },
    })
  ));

  return ok({ saved: true });
}
