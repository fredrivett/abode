import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getE2EPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL },
      },
    });
  }
  return prisma;
}

export async function disconnectE2EPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
