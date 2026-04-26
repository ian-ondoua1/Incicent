import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const [agencies, byStatus] = await Promise.all([
    prisma.agency.findMany({
      select: {
        id: true, name: true, city: true,
        incidents: {
          where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
          select: { id: true, priority: true, status: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.incident.groupBy({ by: ["status"], _count: true }),
  ]);

  return NextResponse.json({ agencies, byStatus, updatedAt: new Date() });
}
