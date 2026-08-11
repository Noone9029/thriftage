export { createPrismaClient, getPrismaClient } from './client';
export { AccountStatus, Prisma, PrismaClient, UserRole } from './generated/client/client';
export type { User } from './generated/client/client';

export const DATABASE_PROVIDER = 'postgresql' as const;
