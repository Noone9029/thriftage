import { Injectable } from '@nestjs/common';
import { getPrismaClient, type DisputeStatus, type Prisma, type PrismaClient } from '@thriftage/db';
import type { DisputeAdminAction, DisputeCreateInput } from '@thriftage/shared';
import { z } from 'zod';
import { DisputeDomainError } from './dispute.errors';
const include = {
  order: { include: { payment: true, shipment: true } },
  evidence: { orderBy: { createdAt: 'asc' } },
  events: { orderBy: { createdAt: 'asc' } },
} as const;
export type DisputeRecord = Prisma.DisputeGetPayload<{ include: typeof include }>;
@Injectable()
export class DisputeRepository {
  constructor(private readonly prisma?: PrismaClient) {}
  private get client() {
    return this.prisma ?? getPrismaClient();
  }
  async create(
    userId: string,
    input: DisputeCreateInput,
    windowHours: number,
    shippedMinAgeHours: number,
  ) {
    try {
      return await this.client.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM orders WHERE id=${input.orderId}::uuid FOR UPDATE`;
        if (rows.length !== 1) throw new DisputeDomainError('DISPUTE_NOT_ELIGIBLE');
        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          include: { payment: true, shipment: true },
        });
        if (!order || ![order.buyerId, order.sellerId].includes(userId))
          throw new DisputeDomainError('DISPUTE_NOT_ELIGIBLE');
        const anchor = order.completedAt ?? order.deliveredAt ?? order.shippedAt;
        if (!anchor || !['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status))
          throw new DisputeDomainError('DISPUTE_NOT_ELIGIBLE');
        const age = (Date.now() - anchor.getTime()) / 3600000;
        if ((order.status === 'SHIPPED' && age < shippedMinAgeHours) || age > windowHours)
          throw new DisputeDomainError('DISPUTE_NOT_ELIGIBLE');
        const counterpartyId = order.buyerId === userId ? order.sellerId : order.buyerId;
        const d = await tx.dispute.create({
          data: { ...input, openerId: userId, counterpartyId },
          include,
        });
        await tx.disputeEvent.create({
          data: { disputeId: d.id, actorId: userId, type: 'OPENED', visibility: 'PARTICIPANTS' },
        });
        await tx.notificationOutbox.create({
          data: {
            recipientId: counterpartyId,
            actorUserId: userId,
            eventType: 'DISPUTE_OPENED',
            disputeId: d.id,
            orderId: order.id,
            dedupeKey: `dispute-opened:${d.id}`,
          },
        });
        return tx.dispute.findUniqueOrThrow({ where: { id: d.id }, include });
      });
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002')
        throw new DisputeDomainError('DISPUTE_ALREADY_EXISTS');
      throw e;
    }
  }
  participant(userId: string, id: string) {
    return this.client.dispute.findFirst({
      where: { id, OR: [{ openerId: userId }, { counterpartyId: userId }] },
      include,
    });
  }
  admin(id: string) {
    return this.client.dispute.findUnique({
      where: { id },
      include: {
        ...include,
        opener: { include: { profile: true } },
        counterparty: { include: { profile: true } },
        safetyActions: true,
        trustAudits: true,
      },
    });
  }
  listParticipant(userId: string) {
    return this.client.dispute.findMany({
      where: { OR: [{ openerId: userId }, { counterpartyId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: { order: true },
    });
  }
  listAdmin(status: DisputeStatus | undefined, query: string | undefined, limit: number) {
    const identifier = query && z.string().uuid().safeParse(query).success ? query : undefined;
    return this.client.dispute.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query
          ? {
              OR: [
                ...(identifier === undefined
                  ? []
                  : [
                      { id: { equals: identifier } },
                      { orderId: { equals: identifier } },
                      { openerId: { equals: identifier } },
                      { counterpartyId: { equals: identifier } },
                    ]),
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { order: true },
    });
  }
  async addEvidence(
    userId: string,
    id: string,
    data: { storageKey: string; width: number; height: number; retainedUntil?: Date },
  ) {
    return this.client.$transaction(async (tx) => {
      const d = await tx.dispute.findFirst({
        where: {
          id,
          OR: [{ openerId: userId }, { counterpartyId: userId }],
          status: { in: ['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION'] },
        },
      });
      if (!d) throw new DisputeDomainError('DISPUTE_NOT_FOUND');
      if ((await tx.disputeEvidence.count({ where: { disputeId: id } })) >= 10)
        throw new DisputeDomainError('DISPUTE_EVIDENCE_LIMIT');
      const e = await tx.disputeEvidence.create({
        data: { disputeId: id, uploadedById: userId, ...data },
      });
      await tx.disputeEvent.create({
        data: {
          disputeId: id,
          actorId: userId,
          type: 'EVIDENCE_ADDED',
          visibility: 'PARTICIPANTS',
        },
      });
      return e;
    });
  }
  async action(adminId: string, id: string, input: DisputeAdminAction) {
    return this.client.$transaction(async (tx) => {
      const d = await tx.dispute.findUnique({ where: { id } });
      if (!d) throw new DisputeDomainError('DISPUTE_NOT_FOUND');
      const transitions: Record<string, DisputeStatus> = {
        START_REVIEW: 'UNDER_REVIEW',
        REQUEST_INFORMATION: 'AWAITING_INFORMATION',
        RESOLVE: 'RESOLVED',
        REJECT: 'REJECTED',
        CLOSE: 'CLOSED',
        REOPEN: 'UNDER_REVIEW',
      };
      if (input.action === 'ADD_INTERNAL_NOTE') {
        await tx.disputeEvent.create({
          data: {
            disputeId: id,
            actorId: adminId,
            type: 'INTERNAL_NOTE',
            visibility: 'INTERNAL',
            message: input.note,
          },
        });
        return tx.dispute.findUniqueOrThrow({ where: { id }, include });
      }
      const allowedFrom: Record<
        Exclude<DisputeAdminAction['action'], 'ADD_INTERNAL_NOTE'>,
        readonly DisputeStatus[]
      > = {
        START_REVIEW: ['OPEN', 'AWAITING_INFORMATION'],
        REQUEST_INFORMATION: ['OPEN', 'UNDER_REVIEW'],
        RESOLVE: ['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION'],
        REJECT: ['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION'],
        CLOSE: ['RESOLVED', 'REJECTED'],
        REOPEN: ['RESOLVED', 'REJECTED', 'CLOSED'],
      };
      if (!allowedFrom[input.action].includes(d.status))
        throw new DisputeDomainError('DISPUTE_TRANSITION_INVALID');
      const status = transitions[input.action];
      if (!status) throw new DisputeDomainError('DISPUTE_TRANSITION_INVALID');
      const terminal = ['RESOLVED', 'REJECTED'].includes(status);
      const updated = await tx.dispute.update({
        where: { id },
        data: {
          status,
          assignedAdminId: adminId,
          ...(terminal
            ? { resolution: input.resolution ?? input.note, resolvedAt: new Date() }
            : {}),
        },
      });
      await tx.disputeEvent.create({
        data: {
          disputeId: id,
          actorId: adminId,
          type: terminal
            ? 'RESOLUTION_RECORDED'
            : input.action === 'REQUEST_INFORMATION'
              ? 'INFORMATION_REQUESTED'
              : 'STATUS_CHANGED',
          visibility: 'PARTICIPANTS',
          message: input.note,
        },
      });
      await tx.trustAudit.create({
        data: {
          actorId: adminId,
          disputeId: id,
          targetUserId: d.openerId,
          reason: input.note,
          action: terminal ? 'DISPUTE_RESOLVED' : 'DISPUTE_STATUS_CHANGED',
        },
      });
      for (const recipientId of [d.openerId, d.counterpartyId])
        await tx.notificationOutbox.create({
          data: {
            recipientId,
            eventType: terminal ? 'DISPUTE_RESOLVED' : 'DISPUTE_UPDATED',
            disputeId: id,
            orderId: d.orderId,
            dedupeKey: `dispute:${id}:${status}:${recipientId}:${updated.updatedAt.getTime()}`,
          },
        });
      return tx.dispute.findUniqueOrThrow({ where: { id }, include });
    });
  }
}
