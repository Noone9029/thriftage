export { createPrismaClient, getPrismaClient } from './client';
export {
  AccountStatus,
  CurrencyCode,
  ListingCondition,
  ListingStatus,
  ModerationAuditAction,
  ModerationReportStatus,
  PhoneVerificationAttemptStatus,
  PhoneVerificationProvider,
  Prisma,
  PrismaClient,
  ReportReason,
  ReportTargetType,
  UserRole,
} from './generated/client/client';
export type {
  Category,
  Follow,
  Listing,
  ListingImage,
  ListingLike,
  ModerationAudit,
  ModerationReport,
  PhoneVerificationAttempt,
  Profile,
  SavedListing,
  User,
} from './generated/client/client';

export const DATABASE_PROVIDER = 'postgresql' as const;
