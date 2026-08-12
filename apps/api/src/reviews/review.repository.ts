import { Injectable } from '@nestjs/common';
import {
  getPrismaClient,
  type Prisma,
  type PrismaClient,
  type ReviewDirection,
  type ReviewModerationState,
  type ReviewReportReason,
} from '@thriftage/db';
import { ReviewDomainError } from './review.errors';
const reviewInclude = {
  reviewer: { include: { profile: true } },
  reviewee: { include: { profile: true } },
} as const;
export type ReviewRecord = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;
@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma?: PrismaClient) {}
  private get client() {
    return this.prisma ?? getPrismaClient();
  }
  async eligibility(userId: string, orderId: string) {
    const order = await this.client.order.findUnique({
      where: { id: orderId },
      include: { reviews: { where: { reviewerId: userId }, include: reviewInclude } },
    });
    if (!order || ![order.buyerId, order.sellerId].includes(userId) || order.status !== 'COMPLETED')
      return { order: null, review: null, direction: null };
    const direction: ReviewDirection =
      order.buyerId === userId ? 'BUYER_TO_SELLER' : 'SELLER_TO_BUYER';
    return { order, review: order.reviews[0] ?? null, direction };
  }
  async create(userId: string, input: { orderId: string; rating: number; text?: string }) {
    try {
      return await this.client.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM orders WHERE id=${input.orderId}::uuid FOR UPDATE`;
        if (rows.length !== 1) throw new ReviewDomainError('REVIEW_NOT_ELIGIBLE');
        const order = await tx.order.findUnique({ where: { id: input.orderId } });
        if (
          !order ||
          order.status !== 'COMPLETED' ||
          ![order.buyerId, order.sellerId].includes(userId)
        )
          throw new ReviewDomainError('REVIEW_NOT_ELIGIBLE');
        const direction: ReviewDirection =
          order.buyerId === userId ? 'BUYER_TO_SELLER' : 'SELLER_TO_BUYER';
        const revieweeId = order.buyerId === userId ? order.sellerId : order.buyerId;
        const review = await tx.review.create({
          data: {
            orderId: order.id,
            reviewerId: userId,
            revieweeId,
            direction,
            rating: input.rating,
            ...(input.text ? { text: input.text } : {}),
          },
          include: reviewInclude,
        });
        await tx.notificationOutbox.create({
          data: {
            recipientId: revieweeId,
            actorUserId: userId,
            eventType: 'REVIEW_RECEIVED',
            reviewId: review.id,
            orderId: order.id,
            dedupeKey: `review:${review.id}`,
          },
        });
        return review;
      });
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002')
        throw new ReviewDomainError('REVIEW_ALREADY_SUBMITTED');
      throw e;
    }
  }
  find(id: string) {
    return this.client.review.findUnique({ where: { id }, include: reviewInclude });
  }
  async listByUsername(username: string, direction: ReviewDirection, limit: number) {
    const profile = await this.client.profile.findUnique({ where: { username } });
    if (!profile) throw new ReviewDomainError('REVIEW_NOT_FOUND');
    const [items, aggregate, groups] = await Promise.all([
      this.client.review.findMany({
        where: { revieweeId: profile.userId, direction, moderationState: { not: 'INVALIDATED' } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: reviewInclude,
      }),
      this.client.review.aggregate({
        where: { revieweeId: profile.userId, direction, moderationState: { not: 'INVALIDATED' } },
        _avg: { rating: true },
        _count: true,
      }),
      this.client.review.groupBy({
        by: ['rating'],
        where: { revieweeId: profile.userId, direction, moderationState: { not: 'INVALIDATED' } },
        _count: true,
      }),
    ]);
    return { items, aggregate, groups };
  }
  report(reporterId: string, reviewId: string, reason: ReviewReportReason, detail?: string) {
    return this.client.reviewReport
      .create({ data: { reporterId, reviewId, reason, ...(detail ? { detail } : {}) } })
      .catch((e) => {
        if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002')
          throw new ReviewDomainError('REVIEW_REPORT_DUPLICATE');
        throw e;
      });
  }
  listReports(status: string | undefined, limit: number) {
    return this.client.reviewReport.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { review: { include: reviewInclude }, reporter: { include: { profile: true } } },
    });
  }
  async moderate(
    adminId: string,
    reviewId: string,
    action: 'HIDE_TEXT' | 'RESTORE' | 'INVALIDATE' | 'DISMISS_REPORT',
    reason: string,
    reportId?: string,
  ) {
    return this.client.$transaction(async (tx) => {
      const current = await tx.review.findUnique({
        where: { id: reviewId },
        include: reviewInclude,
      });
      if (!current) throw new ReviewDomainError('REVIEW_NOT_FOUND');
      let next: ReviewModerationState = current.moderationState;
      if (action === 'HIDE_TEXT') next = 'TEXT_HIDDEN';
      if (action === 'RESTORE') next = 'VISIBLE';
      if (action === 'INVALIDATE') next = 'INVALIDATED';
      if (action !== 'DISMISS_REPORT')
        await tx.review.update({ where: { id: reviewId }, data: { moderationState: next } });
      if (reportId)
        await tx.reviewReport.update({
          where: { id: reportId },
          data: {
            assignedAdminId: adminId,
            status: action === 'DISMISS_REPORT' ? 'DISMISSED' : 'ACTIONED',
            resolution: reason,
            resolvedAt: new Date(),
          },
        });
      await tx.reviewModerationAudit.create({
        data: {
          reviewId,
          ...(reportId ? { reportId } : {}),
          actorId: adminId,
          previousState: current.moderationState,
          nextState: next,
          reason,
        },
      });
      await tx.trustAudit.create({
        data: {
          actorId: adminId,
          reviewId,
          ...(reportId ? { reviewReportId: reportId } : {}),
          reason,
          action:
            action === 'HIDE_TEXT'
              ? 'REVIEW_HIDDEN'
              : action === 'RESTORE'
                ? 'REVIEW_RESTORED'
                : action === 'INVALIDATE'
                  ? 'REVIEW_INVALIDATED'
                  : 'REVIEW_REPORT_DISMISSED',
        },
      });
      return tx.review.findUniqueOrThrow({ where: { id: reviewId }, include: reviewInclude });
    });
  }
}
