import { PrismaClient } from '@prisma/client'

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as unknown as { prisma: PrismaClient }

let prisma: PrismaClient;

try {
  prisma = globalForPrisma.prisma || new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
} catch (error) {
  console.error('Failed to initialize Prisma client:', error);
  prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma