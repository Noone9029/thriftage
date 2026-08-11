import { Injectable } from '@nestjs/common';
import { getPrismaClient, Prisma, type PrismaClient } from '@thriftage/db';
import type { FeedMode } from '@thriftage/shared';

export interface DiscoveryCursor {
  readonly asOf: Date;
  readonly createdAt: Date;
  readonly id: string;
  readonly mode: FeedMode;
  readonly score: number;
}

export interface DiscoveryRank {
  readonly createdAt: Date;
  readonly id: string;
  readonly score: number;
}

@Injectable()
export class DiscoveryRepository {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async rank(
    mode: FeedMode,
    viewerId: string | undefined,
    asOf: Date,
    cursor: DiscoveryCursor | null,
    limit: number,
  ): Promise<{ readonly hasMore: boolean; readonly ranks: readonly DiscoveryRank[] }> {
    const followedBoost =
      mode === 'RECOMMENDED' && viewerId !== undefined
        ? Prisma.sql`CASE WHEN EXISTS (
            SELECT 1 FROM "follows" f
            WHERE f."follower_id" = ${viewerId}::uuid AND f."followed_id" = e."seller_id"
          ) THEN 1000 ELSE 0 END`
        : Prisma.sql`0`;
    const cursorFilter =
      cursor === null
        ? Prisma.empty
        : mode === 'NEW'
          ? Prisma.sql`AND (
              s."created_at" < ${cursor.createdAt} OR
              (s."created_at" = ${cursor.createdAt} AND s."id" < ${cursor.id}::uuid)
            )`
          : Prisma.sql`AND (
              s."score" < ${cursor.score} OR
              (s."score" = ${cursor.score} AND s."created_at" < ${cursor.createdAt}) OR
              (s."score" = ${cursor.score} AND s."created_at" = ${cursor.createdAt} AND s."id" < ${cursor.id}::uuid)
            )`;
    const order =
      mode === 'NEW'
        ? Prisma.sql`s."created_at" DESC, s."id" DESC`
        : Prisma.sql`s."score" DESC, s."created_at" DESC, s."id" DESC`;
    const rows = await this.client.$queryRaw<DiscoveryRank[]>(Prisma.sql`
      WITH engagement AS (
        SELECT
          l."id",
          l."seller_id",
          l."created_at",
          (SELECT COUNT(*)::int FROM "listing_likes" ll
            WHERE ll."listing_id" = l."id" AND ll."created_at" <= ${asOf}) AS "like_count",
          (SELECT COUNT(*)::int FROM "saved_listings" sl
            WHERE sl."listing_id" = l."id" AND sl."created_at" <= ${asOf}) AS "save_count"
        FROM "listings" l
        JOIN "users" u ON u."id" = l."seller_id"
        WHERE l."status" = 'ACTIVE'
          AND l."created_at" <= ${asOf}
          AND u."account_status" = 'ACTIVE'
          AND u."deleted_at" IS NULL
      ),
      scored AS (
        SELECT
          e."id",
          e."created_at",
          (
            e."like_count" * 30 +
            e."save_count" * 40 +
            GREATEST(0, 720 - FLOOR(EXTRACT(EPOCH FROM (${asOf}::timestamptz - e."created_at")) / 3600)::int) +
            ${followedBoost}
          )::int AS "score"
        FROM engagement e
      )
      SELECT s."id", s."created_at" AS "createdAt", s."score"
      FROM scored s
      WHERE TRUE ${cursorFilter}
      ORDER BY ${order}
      LIMIT ${limit + 1}
    `);
    return { hasMore: rows.length > limit, ranks: rows.slice(0, limit) };
  }
}
