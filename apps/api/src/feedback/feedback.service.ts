import { Inject, Injectable } from '@nestjs/common';
import type { AiResponseFeedback, BetaFeedback } from '@thriftage/db';
import {
  adminAiResponseFeedbackPageSchema,
  adminBetaFeedbackPageSchema,
  aiResponseFeedbackInputSchema,
  aiResponseFeedbackSchema,
  betaFeedbackInputSchema,
  betaFeedbackSchema,
  feedbackModerationInputSchema,
  feedbackQueueQuerySchema,
  type AdminAiResponseFeedbackPage,
  type AdminBetaFeedbackPage,
  type AiResponseFeedback as AiResponseFeedbackContract,
  type AiResponseFeedbackInput,
  type BetaFeedback as BetaFeedbackContract,
  type BetaFeedbackInput,
  type FeedbackModerationInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { decodeCursor, encodeCursor } from '../common/cursor';
import { FeedbackDomainError, mapFeedbackError } from './feedback.errors';
import {
  FeedbackRepository,
  type AiFeedbackWithGeneration,
  type FeedbackCursor,
} from './feedback.repository';

const cursorSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  kind: z.enum(['AI_FEEDBACK', 'BETA_FEEDBACK']),
});

@Injectable()
export class FeedbackService {
  public constructor(@Inject(FeedbackRepository) private readonly repository: FeedbackRepository) {}

  public async submitBeta(userId: string, input: BetaFeedbackInput): Promise<BetaFeedbackContract> {
    try {
      return this.serializeBeta(
        await this.repository.createBetaFeedback(userId, betaFeedbackInputSchema.parse(input)),
      );
    } catch (error: unknown) {
      throw mapFeedbackError(error);
    }
  }

  public async submitAi(
    userId: string,
    generationId: string,
    input: AiResponseFeedbackInput,
  ): Promise<AiResponseFeedbackContract> {
    try {
      return this.serializeAi(
        await this.repository.upsertAiFeedback(
          userId,
          generationId,
          aiResponseFeedbackInputSchema.parse(input),
        ),
      );
    } catch (error: unknown) {
      throw mapFeedbackError(error);
    }
  }

  public async listBeta(queryInput: unknown): Promise<AdminBetaFeedbackPage> {
    try {
      const query = feedbackQueueQuerySchema.parse(queryInput);
      const cursor = this.parseCursor(query.cursor, 'BETA_FEEDBACK');
      const result = await this.repository.listBetaFeedback(
        query.status ?? 'OPEN',
        query.limit,
        cursor,
      );
      const last = result.rows.at(-1);
      return adminBetaFeedbackPageSchema.parse({
        items: result.rows.map((row) => ({
          ...this.serializeBeta(row),
          resolution: row.resolution,
          reviewedAt: row.reviewedAt?.toISOString() ?? null,
          userId: row.userId,
        })),
        nextCursor: this.nextCursor(result.hasMore, last, 'BETA_FEEDBACK'),
      });
    } catch (error: unknown) {
      throw mapFeedbackError(error);
    }
  }

  public async listAi(queryInput: unknown): Promise<AdminAiResponseFeedbackPage> {
    try {
      const query = feedbackQueueQuerySchema.parse(queryInput);
      const cursor = this.parseCursor(query.cursor, 'AI_FEEDBACK');
      const result = await this.repository.listAiFeedback(
        query.status ?? 'OPEN',
        query.limit,
        cursor,
      );
      const last = result.rows.at(-1);
      return adminAiResponseFeedbackPageSchema.parse({
        items: result.rows.map((row) => ({
          ...this.serializeAi(row),
          generation: row.generation,
          resolution: row.resolution,
          reviewedAt: row.reviewedAt?.toISOString() ?? null,
          userId: row.userId,
        })),
        nextCursor: this.nextCursor(result.hasMore, last, 'AI_FEEDBACK'),
      });
    } catch (error: unknown) {
      throw mapFeedbackError(error);
    }
  }

  public async moderateBeta(adminId: string, id: string, input: FeedbackModerationInput) {
    try {
      const row = await this.repository.moderateBetaFeedback(
        adminId,
        id,
        feedbackModerationInputSchema.parse(input),
      );
      return {
        ...this.serializeBeta(row),
        resolution: row.resolution,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        userId: row.userId,
      };
    } catch (error: unknown) {
      throw mapFeedbackError(error);
    }
  }

  public async moderateAi(adminId: string, id: string, input: FeedbackModerationInput) {
    try {
      const row = await this.repository.moderateAiFeedback(
        adminId,
        id,
        feedbackModerationInputSchema.parse(input),
      );
      const generation = await this.repository.db.aiGeneration.findUnique({
        select: {
          failureCode: true,
          promptVersion: true,
          provider: true,
          requestedModel: true,
          status: true,
        },
        where: { id: row.generationId },
      });
      if (generation === null) throw new Error('generation missing');
      return {
        ...this.serializeAi(row),
        generation,
        resolution: row.resolution,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        userId: row.userId,
      };
    } catch (error: unknown) {
      throw mapFeedbackError(error);
    }
  }

  private parseCursor(
    raw: string | undefined,
    kind: 'AI_FEEDBACK' | 'BETA_FEEDBACK',
  ): FeedbackCursor | null {
    const cursor = decodeCursor(raw, cursorSchema);
    if (cursor === null) return null;
    if (cursor.kind !== kind) throw new FeedbackDomainError('FEEDBACK_VALIDATION_FAILED');
    return { createdAt: new Date(cursor.createdAt), id: cursor.id };
  }

  private nextCursor(
    hasMore: boolean,
    last: { readonly createdAt: Date; readonly id: string } | undefined,
    kind: 'AI_FEEDBACK' | 'BETA_FEEDBACK',
  ): string | null {
    return hasMore && last !== undefined
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id, kind })
      : null;
  }

  private serializeBeta(row: BetaFeedback): BetaFeedbackContract {
    return betaFeedbackSchema.parse({
      appVersion: row.appVersion,
      buildNumber: row.buildNumber,
      category: row.category,
      createdAt: row.createdAt.toISOString(),
      description: row.description,
      id: row.id,
      platform: row.platform,
      ...(row.route === null ? {} : { route: row.route }),
      status: row.status,
    });
  }

  private serializeAi(
    row: AiResponseFeedback | AiFeedbackWithGeneration,
  ): AiResponseFeedbackContract {
    return aiResponseFeedbackSchema.parse({
      createdAt: row.createdAt.toISOString(),
      generationId: row.generationId,
      id: row.id,
      kind: row.kind,
      reason: row.reason,
      status: row.status,
    });
  }
}
