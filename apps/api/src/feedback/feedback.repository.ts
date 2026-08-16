import { Injectable } from '@nestjs/common';
import {
  getPrismaClient,
  Prisma,
  type AiResponseFeedback,
  type BetaFeedback,
  type FeedbackReviewStatus,
  type PrismaClient,
} from '@thriftage/db';
import type {
  AiResponseFeedbackInput,
  BetaFeedbackInput,
  FeedbackModerationInput,
} from '@thriftage/shared';

import { FeedbackDomainError } from './feedback.errors';

export interface FeedbackCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export type AiFeedbackWithGeneration = Prisma.AiResponseFeedbackGetPayload<{
  include: {
    generation: {
      select: {
        failureCode: true;
        promptVersion: true;
        provider: true;
        requestedModel: true;
        status: true;
      };
    };
  };
}>;

@Injectable()
export class FeedbackRepository {
  public constructor(private readonly prisma?: PrismaClient) {}

  public get db(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async createBetaFeedback(userId: string, input: BetaFeedbackInput): Promise<BetaFeedback> {
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const submittedToday = await transaction.betaFeedback.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1_000) }, userId },
      });
      if (submittedToday >= 10) throw new FeedbackDomainError('FEEDBACK_RATE_LIMITED');
      return transaction.betaFeedback.create({
        data: {
          appVersion: input.appVersion,
          buildNumber: input.buildNumber,
          category: input.category,
          description: input.description,
          platform: input.platform,
          ...(input.route === undefined ? {} : { route: input.route }),
          userId,
        },
      });
    });
  }

  public async upsertAiFeedback(
    userId: string,
    generationId: string,
    input: AiResponseFeedbackInput,
  ): Promise<AiResponseFeedback> {
    return this.db.$transaction(async (transaction) => {
      const generation = await transaction.aiGeneration.findFirst({
        select: { id: true },
        where: {
          id: generationId,
          responsePayload: { not: Prisma.JsonNull },
          status: { in: ['SUCCEEDED', 'FALLBACK', 'REFUSED'] },
          userId,
        },
      });
      if (generation === null) {
        throw new FeedbackDomainError('FEEDBACK_GENERATION_NOT_FOUND');
      }
      const status = input.kind === 'REPORT' ? 'OPEN' : 'ACTIONED';
      return transaction.aiResponseFeedback.upsert({
        create: {
          generationId,
          kind: input.kind,
          reason: input.reason ?? null,
          status,
          userId,
        },
        update: {
          kind: input.kind,
          reason: input.reason ?? null,
          resolution: null,
          reviewedAt: null,
          reviewerId: null,
          status,
        },
        where: { userId_generationId: { generationId, userId } },
      });
    });
  }

  public async listBetaFeedback(
    status: FeedbackReviewStatus,
    limit: number,
    cursor: FeedbackCursor | null,
  ): Promise<{ readonly hasMore: boolean; readonly rows: readonly BetaFeedback[] }> {
    const rows = await this.db.betaFeedback.findMany({
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
    return { hasMore: rows.length > limit, rows: rows.slice(0, limit) };
  }

  public async listAiFeedback(
    status: FeedbackReviewStatus,
    limit: number,
    cursor: FeedbackCursor | null,
  ): Promise<{ readonly hasMore: boolean; readonly rows: readonly AiFeedbackWithGeneration[] }> {
    const rows = await this.db.aiResponseFeedback.findMany({
      include: {
        generation: {
          select: {
            failureCode: true,
            promptVersion: true,
            provider: true,
            requestedModel: true,
            status: true,
          },
        },
      },
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
    return { hasMore: rows.length > limit, rows: rows.slice(0, limit) };
  }

  public moderateBetaFeedback(
    adminId: string,
    id: string,
    input: FeedbackModerationInput,
  ): Promise<BetaFeedback> {
    return this.moderate('beta', adminId, id, input);
  }

  public moderateAiFeedback(
    adminId: string,
    id: string,
    input: FeedbackModerationInput,
  ): Promise<AiResponseFeedback> {
    return this.moderate('ai', adminId, id, input);
  }

  private async moderate<T extends 'ai' | 'beta'>(
    kind: T,
    adminId: string,
    id: string,
    input: FeedbackModerationInput,
  ): Promise<T extends 'ai' ? AiResponseFeedback : BetaFeedback> {
    return this.db.$transaction(async (transaction) => {
      const rows =
        kind === 'ai'
          ? await transaction.$queryRaw<Array<{ readonly status: FeedbackReviewStatus }>>`
              SELECT "status"::text AS "status"
              FROM "ai_response_feedback"
              WHERE "id" = ${id}::uuid
              FOR UPDATE
            `
          : await transaction.$queryRaw<Array<{ readonly status: FeedbackReviewStatus }>>`
              SELECT "status"::text AS "status"
              FROM "beta_feedback"
              WHERE "id" = ${id}::uuid
              FOR UPDATE
            `;
      const row = rows[0];
      if (row === undefined) throw new FeedbackDomainError('FEEDBACK_NOT_FOUND');
      if (row.status === 'ACTIONED' || row.status === 'DISMISSED') {
        throw new FeedbackDomainError('FEEDBACK_TRANSITION_INVALID');
      }
      const data = {
        resolution: input.resolution ?? null,
        reviewedAt: input.status === 'UNDER_REVIEW' ? null : new Date(),
        reviewerId: adminId,
        status: input.status,
      };
      if (kind === 'ai') {
        return (await transaction.aiResponseFeedback.update({
          data,
          where: { id },
        })) as T extends 'ai' ? AiResponseFeedback : BetaFeedback;
      }
      return (await transaction.betaFeedback.update({ data, where: { id } })) as T extends 'ai'
        ? AiResponseFeedback
        : BetaFeedback;
    });
  }
}
