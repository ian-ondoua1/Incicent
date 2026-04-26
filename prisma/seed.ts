import { PrismaClient, Role, Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Admin par défaut ──────────────────────────────────────
  const adminEmail = "admin@incident-portal.cm";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hashed = await bcrypt.hash("root", 12);
    await prisma.user.create({
      data: { name: "Admin", email: adminEmail, password: hashed, role: Role.ADMIN },
    });
    console.log("✅ Admin créé — email: admin@incident-portal.cm | password: root");
  } else {
    console.log("ℹ️  Admin déjà existant.");
  }

  // ── SLA par défaut ────────────────────────────────────────
  const slaDefaults = [
    { priority: Priority.LOW,      responseTime: 480,  resolutionTime: 2880 }, // 8h / 48h
    { priority: Priority.MEDIUM,   responseTime: 240,  resolutionTime: 1440 }, // 4h / 24h
    { priority: Priority.HIGH,     responseTime: 60,   resolutionTime: 480  }, // 1h / 8h
    { priority: Priority.CRITICAL, responseTime: 15,   resolutionTime: 120  }, // 15min / 2h
  ];

  for (const sla of slaDefaults) {
    await prisma.slaConfig.upsert({
      where: { priority: sla.priority },
      update: {},
      create: sla,
    });
  }
  console.log("✅ SLA par défaut configurés (LOW→48h, MEDIUM→24h, HIGH→8h, CRITICAL→2h)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
