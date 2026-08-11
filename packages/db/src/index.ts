export { createPrismaClient, getPrismaClient } from './client';
export {
  AccountStatus,
  PhoneVerificationAttemptStatus,
  PhoneVerificationProvider,
  Prisma,
  PrismaClient,
  UserRole,
} from './generated/client/client';
export type { PhoneVerificationAttempt, Profile, User } from './generated/client/client';

export const DATABASE_PROVIDER = 'postgresql' as const;
