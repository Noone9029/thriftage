import { Inject, Injectable } from '@nestjs/common';
import {
  adminListingDetailSchema,
  adminListingQueueSchema,
  listingModerationInputSchema,
  listingReportInputSchema,
  moderationReportPageSchema,
  moderationReportQuerySchema,
  moderationReportSchema,
  moderationReportUpdateInputSchema,
  sellerListingQuerySchema,
  userReportInputSchema,
  type AdminListingDetail,
  type ListingPage,
  type ListingReportInput,
  type ModerationReport,
  type ModerationReportUpdateInput,
  type UserReportInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { decodeCursor, encodeCursor } from '../common/cursor';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { mapMarketplaceError, MarketplaceDomainError } from '../common/marketplace.errors';
import { ListingPresenter } from '../listings/listing.presenter';
import type { ListingRecord } from '../listings/listing.repository';
import { ModerationRepository } from './moderation.repository';

const chronologicalCursorSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  kind: z.enum(['MODERATION_LIST', 'REPORT_LIST']),
});

@Injectable()
export class ModerationService {
  public constructor(
    @Inject(ModerationRepository) private readonly repository: ModerationRepository,
    @Inject(ListingPresenter) private readonly presenter: ListingPresenter,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
  ) {}

  public async reportListing(userId: string, input: ListingReportInput): Promise<ModerationReport> {
    try {
      const parsed = listingReportInputSchema.parse(input);
      const report = await this.repository.createListingReport(userId, parsed);
      this.events.publish({
        actorId: userId,
        listingId: parsed.listingId,
        name: 'report_submitted',
      });
      return this.serializeReport(report);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async reportUser(userId: string, input: UserReportInput): Promise<ModerationReport> {
    try {
      const parsed = userReportInputSchema.parse(input);
      const report = await this.repository.createUserReport(userId, parsed);
      this.events.publish({
        actorId: userId,
        name: 'report_submitted',
        targetUserId: parsed.userId,
      });
      return this.serializeReport(report);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async listReports(
    queryInput: unknown,
  ): Promise<z.infer<typeof moderationReportPageSchema>> {
    try {
      const query = moderationReportQuerySchema.parse(queryInput);
      const cursor = this.parseCursor(query.cursor, 'REPORT_LIST');
      const result = await this.repository.listReports(query, cursor);
      const last = result.reports.at(-1);
      return moderationReportPageSchema.parse({
        items: result.reports.map((report) => this.serializeReport(report)),
        nextCursor:
          result.hasMore && last !== undefined
            ? encodeCursor({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
                kind: 'REPORT_LIST',
              })
            : null,
      });
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async updateReport(
    adminId: string,
    reportId: string,
    input: ModerationReportUpdateInput,
  ): Promise<ModerationReport> {
    try {
      return this.serializeReport(
        await this.repository.updateReport(
          adminId,
          reportId,
          moderationReportUpdateInputSchema.parse(input),
        ),
      );
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async listListings(queryInput: unknown): Promise<ListingPage> {
    try {
      const query = sellerListingQuerySchema.parse(queryInput);
      const status = query.status ?? 'PENDING_REVIEW';
      const cursor = this.parseCursor(query.cursor, 'MODERATION_LIST');
      const result = await this.repository.listListings(status, query.limit, cursor);
      const items = await this.presentAdmin(result.records);
      const last = result.records.at(-1);
      return adminListingQueueSchema.parse({
        items,
        nextCursor:
          result.hasMore && last !== undefined
            ? encodeCursor({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
                kind: 'MODERATION_LIST',
              })
            : null,
      });
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async getListing(listingId: string): Promise<AdminListingDetail> {
    try {
      const record = await this.repository.findListing(listingId);
      if (record === null) throw new MarketplaceDomainError('LISTING_NOT_FOUND');
      const [listing] = await this.presentAdmin([record]);
      if (listing === undefined) throw new MarketplaceDomainError('MARKETPLACE_SERVICE_ERROR');
      const audits = await this.repository.listListingAudits(listingId);
      return adminListingDetailSchema.parse({
        audits: audits.map((audit) => ({
          action: audit.action,
          actorId: audit.actorId,
          createdAt: audit.createdAt.toISOString(),
          id: audit.id,
          nextState: audit.nextState,
          previousState: audit.previousState,
          reason: audit.reason,
        })),
        listing,
      });
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async moderateListing(
    adminId: string,
    listingId: string,
    action: 'APPROVE' | 'REJECT' | 'REMOVE',
    input: unknown,
  ): Promise<AdminListingDetail> {
    try {
      const { reason } = listingModerationInputSchema.parse(input);
      const record = await this.repository.moderateListing(adminId, listingId, action, reason);
      this.events.publish({
        actorId: adminId,
        listingId,
        name:
          action === 'APPROVE'
            ? 'listing_approved'
            : action === 'REJECT'
              ? 'listing_rejected'
              : 'listing_archived',
      });
      return this.getListing(record.id);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  private async presentAdmin(records: readonly ListingRecord[]) {
    const presented = await this.presenter.presentMany(records, {
      likedIds: new Set(),
      savedIds: new Set(),
    });
    return presented.map((listing, index) => ({
      ...listing,
      openReportCount: records[index]?._count.reports ?? 0,
    }));
  }

  private parseCursor(raw: string | undefined, kind: 'MODERATION_LIST' | 'REPORT_LIST') {
    const cursor = decodeCursor(raw, chronologicalCursorSchema);
    if (cursor === null) return null;
    if (cursor.kind !== kind) throw new MarketplaceDomainError('VALIDATION_FAILED');
    return { createdAt: new Date(cursor.createdAt), id: cursor.id };
  }

  private serializeReport(report: {
    readonly assignedAdminId: string | null;
    readonly createdAt: Date;
    readonly detail: string | null;
    readonly id: string;
    readonly listingId: string | null;
    readonly reason: string;
    readonly reporterId: string;
    readonly resolution: string | null;
    readonly resolvedAt: Date | null;
    readonly status: string;
    readonly targetType: string;
    readonly targetUserId: string | null;
    readonly updatedAt: Date;
  }): ModerationReport {
    return moderationReportSchema.parse({
      ...report,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      updatedAt: report.updatedAt.toISOString(),
    });
  }
}
