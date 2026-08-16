import { Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import { getPrismaClient } from '@thriftage/db';
import { closedBetaOperationsSchema, type ClosedBetaOperations } from '@thriftage/shared';

@Injectable()
export class ClosedBetaOperationsService {
  public async snapshot(): Promise<ClosedBetaOperations> {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const db = getPrismaClient();
    const [
      activeUsers,
      registeredUsers,
      createdListings,
      pendingListings,
      activeListings,
      messages,
      createdOrders,
      completedOrders,
      cancelledOrders,
      awaitingFinalization,
      openDisputes,
      openReports,
      openMessageFlags,
      openAiFeedback,
      notificationPending,
      notificationFailed,
      oldestNotification,
      accountDeletionPending,
      accountDeletionFailed,
      aiGenerations,
      aiFailures,
      aiCost,
    ] = await Promise.all([
      db.user.count({ where: { accountStatus: 'ACTIVE' } }),
      db.user.count({ where: { createdAt: { gte: since } } }),
      db.listing.count({ where: { createdAt: { gte: since } } }),
      db.listing.count({ where: { status: 'PENDING_REVIEW' } }),
      db.listing.count({ where: { status: 'ACTIVE' } }),
      db.message.count({ where: { createdAt: { gte: since } } }),
      db.order.count({ where: { createdAt: { gte: since } } }),
      db.order.count({ where: { completedAt: { gte: since } } }),
      db.order.count({ where: { cancelledAt: { gte: since } } }),
      db.order.count({ where: { status: 'DELIVERED' } }),
      db.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION'] } },
      }),
      db.moderationReport.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      db.messageModerationFlag.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      db.aiResponseFeedback.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      db.notificationOutbox.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      db.notificationOutbox.count({ where: { status: 'FAILED' } }),
      db.notificationOutbox.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      }),
      db.accountDeletionRequest.count({
        where: { status: { in: ['REQUESTED', 'PROCESSING', 'RETRY'] } },
      }),
      db.accountDeletionRequest.count({ where: { status: 'FAILED' } }),
      db.aiGeneration.count({ where: { startedAt: { gte: since } } }),
      db.aiGeneration.count({ where: { startedAt: { gte: since }, status: 'FAILED' } }),
      db.aiGeneration.aggregate({
        _sum: { estimatedCostMicroUsd: true },
        where: { startedAt: { gte: since } },
      }),
    ]);
    const config = loadApiConfig(process.env);

    return closedBetaOperationsSchema.parse({
      ai: {
        estimatedCostMicroUsd: aiCost._sum.estimatedCostMicroUsd ?? 0,
        failedGenerations: aiFailures,
        generations: aiGenerations,
      },
      externalSignals: {
        crashReporting: 'SENTRY_DASHBOARD_REQUIRED',
        smsCosts: 'TWILIO_CONSOLE_REQUIRED',
      },
      generatedAt: now.toISOString(),
      listings: {
        active: activeListings,
        created: createdListings,
        pendingReview: pendingListings,
      },
      messages: { sent: messages },
      orders: {
        cancelled: cancelledOrders,
        completed: completedOrders,
        created: createdOrders,
        deliveredAwaitingFinalization: awaitingFinalization,
      },
      runtime: {
        accountDeletion: config.accountDeletionEnabled,
        aiStylist: config.aiStylistEnabled,
        environment: config.deploymentEnvironment,
        phoneAuth: config.phoneAuthEnabled,
        pushNotifications: config.expoPushEnabled,
        registration: config.registrationEnabled,
        sellerVerification: config.sellerVerificationEnabled,
        releaseVersion: config.releaseVersion,
      },
      safety: {
        openAiFeedback,
        openDisputes,
        openMessageFlags,
        openReports,
      },
      users: { active: activeUsers, registered: registeredUsers },
      windowHours: 24,
      workers: {
        accountDeletionFailed,
        accountDeletionPending,
        notificationFailed,
        notificationOldestPendingAgeSeconds:
          oldestNotification === null
            ? null
            : Math.max(
                0,
                Math.floor((now.getTime() - oldestNotification.createdAt.getTime()) / 1_000),
              ),
        notificationPending,
      },
    });
  }
}
