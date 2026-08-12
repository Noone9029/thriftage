import { Inject, Injectable } from '@nestjs/common';
import {
  reviewAdminActionSchema,
  reviewCreateInputSchema,
  reviewEligibilitySchema,
  reviewPageSchema,
  reviewQuerySchema,
  reviewReportInputSchema,
  reviewReportQuerySchema,
  reviewReportSchema,
  reviewSchema,
  type ReviewAdminAction,
  type ReviewCreateInput,
  type ReviewReportInput,
} from '@thriftage/shared';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { PolicyService } from '../trust/policy.service';
import { SafetyService } from '../trust/safety.service';
import { mapReviewError, ReviewDomainError } from './review.errors';
import { ReviewRepository, type ReviewRecord } from './review.repository';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(ReviewRepository) private readonly repository: ReviewRepository,
    @Inject(PolicyService) private readonly policies: PolicyService,
    @Inject(SafetyService) private readonly safety: SafetyService,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
  ) {}
  private review(r: ReviewRecord) {
    return reviewSchema.parse({
      id: r.id,
      orderId: r.orderId,
      reviewerId: r.reviewerId,
      revieweeId: r.revieweeId,
      reviewerUsername: r.reviewer.profile?.username ?? 'unavailable',
      revieweeUsername: r.reviewee.profile?.username ?? 'unavailable',
      direction: r.direction,
      rating: r.rating,
      text: r.moderationState === 'VISIBLE' ? r.text : null,
      moderationState: r.moderationState,
      createdAt: r.createdAt.toISOString(),
    });
  }
  async eligibility(userId: string, orderId: string) {
    try {
      const x = await this.repository.eligibility(userId, orderId);
      return reviewEligibilitySchema.parse({
        eligible: x.order !== null && x.review === null,
        review: x.review ? this.review(x.review) : null,
        direction: x.direction,
      });
    } catch (e) {
      throw mapReviewError(e);
    }
  }
  async create(userId: string, input: ReviewCreateInput) {
    try {
      await this.policies.assertUgcAccepted(userId);
      await this.safety.assertScopeAllowed(userId, 'SOCIAL');
      const parsed = reviewCreateInputSchema.parse(input);
      const r = await this.repository.create(userId, {
        orderId: parsed.orderId,
        rating: parsed.rating,
        ...(parsed.text === undefined ? {} : { text: parsed.text }),
      });
      this.events.publish({
        actorId: userId,
        name: 'review_submitted',
        orderId: r.orderId,
        reviewId: r.id,
        targetUserId: r.revieweeId,
      });
      return this.review(r);
    } catch (e) {
      throw mapReviewError(e);
    }
  }
  async list(username: string, input: unknown) {
    try {
      const q = reviewQuerySchema.parse(input);
      const x = await this.repository.listByUsername(username, q.direction, q.limit);
      const distribution: { '1': number; '2': number; '3': number; '4': number; '5': number } = {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      };
      for (const g of x.groups)
        distribution[String(g.rating) as keyof typeof distribution] = g._count;
      return reviewPageSchema.parse({
        items: x.items.map((r) => this.review(r)),
        nextCursor: null,
        summary: { average: x.aggregate._avg.rating, count: x.aggregate._count, distribution },
      });
    } catch (e) {
      throw mapReviewError(e);
    }
  }
  async report(userId: string, id: string, input: ReviewReportInput) {
    try {
      const review = await this.repository.find(id);
      if (!review || review.reviewerId === userId) throw new ReviewDomainError('REVIEW_NOT_FOUND');
      const p = reviewReportInputSchema.parse(input);
      const r = await this.repository.report(userId, id, p.reason, p.detail);
      this.events.publish({ actorId: userId, name: 'review_reported', reviewId: id });
      return reviewReportSchema.parse({ ...r, createdAt: r.createdAt.toISOString() });
    } catch (e) {
      throw mapReviewError(e);
    }
  }
  async reports(input: unknown) {
    try {
      const q = reviewReportQuerySchema.parse(input);
      const rows = await this.repository.listReports(q.status, q.limit);
      return {
        items: rows.map((x) => ({
          report: reviewReportSchema.parse({ ...x, createdAt: x.createdAt.toISOString() }),
          review: this.review(x.review),
          reporterUsername: x.reporter.profile?.username ?? null,
        })),
      };
    } catch (e) {
      throw mapReviewError(e);
    }
  }
  async moderate(adminId: string, id: string, input: ReviewAdminAction) {
    try {
      const p = reviewAdminActionSchema.parse(input);
      return this.review(
        await this.repository.moderate(adminId, id, p.action, p.reason, p.reportId),
      );
    } catch (e) {
      throw mapReviewError(e);
    }
  }
}
