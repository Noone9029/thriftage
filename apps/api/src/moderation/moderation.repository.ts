import { Injectable } from '@nestjs/common';
import {
  getPrismaClient,
  type ModerationReport,
  type Prisma,
  type PrismaClient,
} from '@thriftage/db';
import type {
  ListingReportInput,
  ListingStatus,
  ModerationReportQuery,
  ModerationReportUpdateInput,
  UserReportInput,
} from '@thriftage/shared';

import { MarketplaceDomainError } from '../common/marketplace.errors';
import {
  listingArgs,
  type ChronologicalCursor,
  type ListingRecord,
} from '../listings/listing.repository';

export type ModerationAuditRecord = Prisma.ModerationAuditGetPayload<Record<string, never>>;

export class ModerationTransitionError extends MarketplaceDomainError {
  public constructor(code: 'LISTING_TRANSITION_INVALID' | 'VALIDATION_FAILED') {
    super(code);
  }
}

@Injectable()
export class ModerationRepository {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async createListingReport(
    reporterId: string,
    input: ListingReportInput,
  ): Promise<ModerationReport> {
    const listing = await this.client.listing.findFirst({
      select: { sellerId: true },
      where: { id: input.listingId, status: 'ACTIVE' },
    });
    if (listing === null) throw new MarketplaceDomainError('LISTING_NOT_PUBLIC');
    if (listing.sellerId === reporterId) {
      throw new MarketplaceDomainError('SELF_INTERACTION_FORBIDDEN');
    }
    try {
      return await this.client.moderationReport.create({
        data: {
          ...(input.detail === undefined ? {} : { detail: input.detail }),
          listingId: input.listingId,
          reason: input.reason,
          reporterId,
          targetType: 'LISTING',
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new MarketplaceDomainError('DUPLICATE_REPORT');
      }
      throw error;
    }
  }

  public async createUserReport(
    reporterId: string,
    input: UserReportInput,
  ): Promise<ModerationReport> {
    if (reporterId === input.userId) {
      throw new MarketplaceDomainError('SELF_INTERACTION_FORBIDDEN');
    }
    const target = await this.client.user.findFirst({
      where: {
        accountStatus: 'ACTIVE',
        deletedAt: null,
        id: input.userId,
        profile: { isNot: null },
      },
    });
    if (target === null) throw new MarketplaceDomainError('SELLER_NOT_FOUND');
    try {
      return await this.client.moderationReport.create({
        data: {
          ...(input.detail === undefined ? {} : { detail: input.detail }),
          reason: input.reason,
          reporterId,
          targetType: 'USER',
          targetUserId: input.userId,
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new MarketplaceDomainError('DUPLICATE_REPORT');
      }
      throw error;
    }
  }

  public async listReports(
    query: ModerationReportQuery,
    cursor: ChronologicalCursor | null,
  ): Promise<{ readonly hasMore: boolean; readonly reports: readonly ModerationReport[] }> {
    const reports = await this.client.moderationReport.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.targetType === undefined ? {} : { targetType: query.targetType }),
        ...(cursor === null
          ? {}
          : {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }),
      },
    });
    return { hasMore: reports.length > query.limit, reports: reports.slice(0, query.limit) };
  }

  public async updateReport(
    adminId: string,
    reportId: string,
    input: ModerationReportUpdateInput,
  ): Promise<ModerationReport> {
    return this.client.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        { id: string; status: ModerationReport['status'] }[]
      >`SELECT "id", "status"::text AS "status" FROM "moderation_reports" WHERE "id" = ${reportId}::uuid FOR UPDATE`;
      const report = rows[0];
      if (report === undefined) throw new MarketplaceDomainError('REPORT_NOT_FOUND');
      if (report.status === 'ACTIONED' || report.status === 'DISMISSED') {
        throw new ModerationTransitionError('VALIDATION_FAILED');
      }
      const action =
        input.status === 'UNDER_REVIEW'
          ? 'REPORT_UNDER_REVIEW'
          : input.status === 'ACTIONED'
            ? 'REPORT_ACTIONED'
            : 'REPORT_DISMISSED';
      const updated = await transaction.moderationReport.update({
        data: {
          assignedAdminId: adminId,
          ...(input.resolution === undefined ? {} : { resolution: input.resolution }),
          resolvedAt: input.status === 'UNDER_REVIEW' ? null : new Date(),
          status: input.status,
        },
        where: { id: reportId },
      });
      await transaction.moderationAudit.create({
        data: {
          action,
          actorId: adminId,
          nextState: input.status,
          previousState: report.status,
          ...(input.resolution === undefined ? {} : { reason: input.resolution }),
          reportId,
        },
      });
      return updated;
    });
  }

  public async listListings(
    status: ListingStatus,
    limit: number,
    cursor: ChronologicalCursor | null,
  ): Promise<{ readonly hasMore: boolean; readonly records: readonly ListingRecord[] }> {
    const records = await this.client.listing.findMany({
      ...listingArgs,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      where: {
        status,
        ...(cursor === null
          ? {}
          : {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }),
      },
    });
    return { hasMore: records.length > limit, records: records.slice(0, limit) };
  }

  public async findListing(listingId: string): Promise<ListingRecord | null> {
    const record = await this.client.listing.findUnique({
      ...listingArgs,
      where: { id: listingId },
    });
    return record;
  }

  public listListingAudits(listingId: string): Promise<ModerationAuditRecord[]> {
    return this.client.moderationAudit.findMany({
      orderBy: { createdAt: 'desc' },
      where: { listingId },
    });
  }

  public async moderateListing(
    adminId: string,
    listingId: string,
    action: 'APPROVE' | 'REJECT' | 'REMOVE',
    reason?: string,
  ): Promise<ListingRecord> {
    return this.client.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        { categoryId: string; status: ListingStatus }[]
      >`SELECT "category_id" AS "categoryId", "status"::text AS "status" FROM "listings" WHERE "id" = ${listingId}::uuid FOR UPDATE`;
      const listing = rows[0];
      if (listing === undefined) throw new MarketplaceDomainError('LISTING_NOT_FOUND');
      if (action === 'APPROVE' && listing.status !== 'PENDING_REVIEW') {
        throw new ModerationTransitionError('LISTING_TRANSITION_INVALID');
      }
      if (action === 'REJECT' && listing.status !== 'PENDING_REVIEW') {
        throw new ModerationTransitionError('LISTING_TRANSITION_INVALID');
      }
      if (
        action === 'REMOVE' &&
        !['ACTIVE', 'PENDING_REVIEW', 'REJECTED'].includes(listing.status)
      ) {
        throw new ModerationTransitionError('LISTING_TRANSITION_INVALID');
      }
      if ((action === 'REJECT' || action === 'REMOVE') && reason === undefined) {
        throw new ModerationTransitionError('VALIDATION_FAILED');
      }
      if (action === 'APPROVE') {
        const [imageCount, category] = await Promise.all([
          transaction.listingImage.count({ where: { listingId } }),
          transaction.category.findFirst({ where: { id: listing.categoryId, isActive: true } }),
        ]);
        if (imageCount < 3 || imageCount > 10) {
          throw new MarketplaceDomainError('LISTING_REQUIRES_IMAGES');
        }
        if (category === null) throw new MarketplaceDomainError('CATEGORY_UNAVAILABLE');
      }
      const nextStatus =
        action === 'APPROVE' ? 'ACTIVE' : action === 'REJECT' ? 'REJECTED' : 'REMOVED';
      const updated = await transaction.listing.update({
        ...listingArgs,
        data: {
          ...(action === 'APPROVE' ? { activatedAt: new Date() } : {}),
          moderatedAt: new Date(),
          rejectionReason: action === 'REJECT' ? (reason ?? null) : null,
          status: nextStatus,
        },
        where: { id: listingId },
      });
      await transaction.moderationAudit.create({
        data: {
          action:
            action === 'APPROVE'
              ? 'LISTING_APPROVED'
              : action === 'REJECT'
                ? 'LISTING_REJECTED'
                : 'LISTING_REMOVED',
          actorId: adminId,
          listingId,
          nextState: nextStatus,
          previousState: listing.status,
          ...(reason === undefined ? {} : { reason }),
        },
      });
      return updated;
    });
  }
}
