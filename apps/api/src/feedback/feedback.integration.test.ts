import { randomUUID } from 'node:crypto';

import { createPrismaClient } from '@thriftage/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FeedbackRepository } from './feedback.repository';
import { FeedbackService } from './feedback.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) throw new Error('TEST_DATABASE_URL is required.');
const prisma = createPrismaClient(testDatabaseUrl);
const repository = new FeedbackRepository(prisma);
const service = new FeedbackService(repository);

async function clear(): Promise<void> {
  await prisma.aiResponseFeedback.deleteMany();
  await prisma.betaFeedback.deleteMany();
  await prisma.aiStylistConversation.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
}

async function user(label: string, role: 'ADMIN' | 'USER' = 'USER') {
  const suffix = randomUUID();
  return prisma.user.create({
    data: {
      authProviderUserId: `feedback-${label}-${suffix}`,
      email: `${suffix}@example.com`,
      fullName: label,
      role,
    },
  });
}

async function generation(userId: string, privateMarker: string) {
  const conversation = await prisma.aiStylistConversation.create({
    data: { title: 'Feedback fixture', userId },
  });
  return prisma.aiGeneration.create({
    data: {
      clientRequestId: randomUUID(),
      completedAt: new Date(),
      conversationId: conversation.id,
      promptVersion: 'test-prompt-v1',
      provider: 'DETERMINISTIC',
      reasoningEffort: 'medium',
      requestedModel: 'test-model',
      responsePayload: { assistantMessage: privateMarker },
      status: 'SUCCEEDED',
      toolSchemaVersion: 'test-tools-v1',
      userId,
    },
  });
}

describe.sequential('beta and AI feedback', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await clear();
  });
  afterEach(clear);
  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('bounds beta submissions and provides a reviewable moderation queue', async () => {
    const submitter = await user('submitter');
    const admin = await user('admin', 'ADMIN');
    for (let index = 0; index < 10; index += 1) {
      await service.submitBeta(submitter.id, {
        appVersion: '0.1.0',
        buildNumber: '42',
        category: index === 0 ? 'SAFETY' : 'BUG',
        description: `Synthetic beta feedback number ${index}.`,
        platform: 'ANDROID',
        route: '/listing-editor/new',
      });
    }
    await expect(
      service.submitBeta(submitter.id, {
        appVersion: '0.1.0',
        buildNumber: '42',
        category: 'BUG',
        description: 'An eleventh report in the rolling window.',
        platform: 'ANDROID',
      }),
    ).rejects.toMatchObject({ code: 'FEEDBACK_RATE_LIMITED', status: 429 });

    const page = await service.listBeta({ limit: 5, status: 'OPEN' });
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).not.toBeNull();
    const selected = page.items[0]!;
    const underReview = await service.moderateBeta(admin.id, selected.id, {
      status: 'UNDER_REVIEW',
    });
    expect(underReview).toMatchObject({ status: 'UNDER_REVIEW', userId: submitter.id });
    const actioned = await service.moderateBeta(admin.id, selected.id, {
      resolution: 'Reproduced and linked to the internal fix record.',
      status: 'ACTIONED',
    });
    expect(actioned).toMatchObject({ status: 'ACTIONED', userId: submitter.id });
    await expect(
      service.moderateBeta(admin.id, selected.id, {
        resolution: 'Closed records are immutable.',
        status: 'DISMISSED',
      }),
    ).rejects.toMatchObject({ code: 'FEEDBACK_TRANSITION_INVALID', status: 409 });
  });

  it('enforces generation ownership and keeps private AI output out of admin queues', async () => {
    const submitter = await user('ai-owner');
    const stranger = await user('ai-stranger');
    const admin = await user('ai-admin', 'ADMIN');
    const privateMarker = 'PRIVATE_STYLIST_TRANSCRIPT_MUST_NOT_ENTER_ADMIN_QUEUE';
    const ownedGeneration = await generation(submitter.id, privateMarker);

    await expect(
      service.submitAi(stranger.id, ownedGeneration.id, { kind: 'HELPFUL' }),
    ).rejects.toMatchObject({ code: 'FEEDBACK_GENERATION_NOT_FOUND', status: 404 });

    const helpful = await service.submitAi(submitter.id, ownedGeneration.id, { kind: 'HELPFUL' });
    const report = await service.submitAi(submitter.id, ownedGeneration.id, {
      kind: 'REPORT',
      reason: 'The advice made an unsafe product claim.',
    });
    expect(report.id).toBe(helpful.id);
    expect(report).toMatchObject({ kind: 'REPORT', status: 'OPEN' });

    const queue = await service.listAi({ status: 'OPEN' });
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({
      generation: {
        promptVersion: 'test-prompt-v1',
        requestedModel: 'test-model',
        status: 'SUCCEEDED',
      },
      reason: 'The advice made an unsafe product claim.',
      userId: submitter.id,
    });
    expect(JSON.stringify(queue)).not.toContain(privateMarker);

    const closed = await service.moderateAi(admin.id, report.id, {
      resolution: 'Reviewed against the safety policy and actioned.',
      status: 'ACTIONED',
    });
    expect(closed).toMatchObject({ status: 'ACTIONED', userId: submitter.id });
  });
});
