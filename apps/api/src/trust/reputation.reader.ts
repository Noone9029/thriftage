import { Injectable } from '@nestjs/common';
import { getPrismaClient, type PrismaClient, type ReviewDirection } from '@thriftage/db';
import { ratingSummarySchema, type RatingSummary } from '@thriftage/shared';
@Injectable()
export class ReputationReader {
  constructor(private readonly prisma?: PrismaClient) {}
  private get client() {
    return this.prisma ?? getPrismaClient();
  }
  async summaries(
    userIds: readonly string[],
    direction: ReviewDirection,
  ): Promise<ReadonlyMap<string, RatingSummary>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    const rows = await this.client.review.groupBy({
      by: ['revieweeId', 'rating'],
      where: { revieweeId: { in: unique }, direction, moderationState: { not: 'INVALIDATED' } },
      _count: true,
    });
    const map = new Map<string, RatingSummary>();
    for (const id of unique) {
      const mine = rows.filter((r) => r.revieweeId === id);
      const count = mine.reduce((n, r) => n + r._count, 0);
      const distribution: { '1': number; '2': number; '3': number; '4': number; '5': number } = {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      };
      for (const r of mine) distribution[String(r.rating) as keyof typeof distribution] = r._count;
      map.set(
        id,
        ratingSummarySchema.parse({
          average: count === 0 ? null : mine.reduce((n, r) => n + r.rating * r._count, 0) / count,
          count,
          distribution,
        }),
      );
    }
    return map;
  }
  async verified(userIds: readonly string[]) {
    const rows = await this.client.sellerVerification.findMany({
      where: { userId: { in: [...new Set(userIds)] }, status: 'VERIFIED' },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }
}
