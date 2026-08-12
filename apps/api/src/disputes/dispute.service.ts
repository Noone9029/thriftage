import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import {
  disputeAdminActionSchema,
  disputeCreateInputSchema,
  disputeDetailSchema,
  disputePageSchema,
  disputeQuerySchema,
  disputeSummarySchema,
  type DisputeAdminAction,
  type DisputeCreateInput,
} from '@thriftage/shared';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import {
  ListingImageProcessor,
  type UploadedListingImage,
} from '../listing-media/listing-image-processor';
import {
  DISPUTE_EVIDENCE_STORAGE,
  type DisputeEvidenceStorage,
} from './dispute-evidence-storage.interface';
import { mapDisputeError, DisputeDomainError } from './dispute.errors';
import { DisputeRepository, type DisputeRecord } from './dispute.repository';
@Injectable()
export class DisputeService {
  constructor(
    @Inject(DisputeRepository) private readonly repo: DisputeRepository,
    @Inject(DISPUTE_EVIDENCE_STORAGE) private readonly storage: DisputeEvidenceStorage,
    @Inject(ListingImageProcessor) private readonly processor: ListingImageProcessor,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
  ) {}
  private summary(d: {
    id: string;
    orderId: string;
    openerId: string;
    counterpartyId: string;
    reason: DisputeRecord['reason'];
    status: DisputeRecord['status'];
    createdAt: Date;
    updatedAt: Date;
    order: { orderNumber: string };
  }) {
    return disputeSummarySchema.parse({
      id: d.id,
      orderId: d.orderId,
      orderNumber: d.order.orderNumber,
      openerId: d.openerId,
      counterpartyId: d.counterpartyId,
      reason: d.reason,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    });
  }
  private async detail(d: DisputeRecord, admin = false) {
    const urls = await this.storage.signedUrls(d.evidence.map((e) => e.storageKey));
    return disputeDetailSchema.parse({
      ...this.summary(d),
      description: d.description,
      resolution: d.resolution,
      listingTitle: d.order.listingTitle,
      paymentStatus: d.order.payment?.status ?? 'UNKNOWN',
      shipmentStatus: d.order.shipment?.status ?? 'UNKNOWN',
      evidence: d.evidence.map((e) => ({
        id: e.id,
        width: e.width,
        height: e.height,
        createdAt: e.createdAt.toISOString(),
        url: urls.get(e.storageKey),
      })),
      timeline: d.events
        .filter((e) => admin || e.visibility === 'PARTICIPANTS')
        .map((e) => ({
          id: e.id,
          type: e.type,
          visibility: e.visibility,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
          actorId: e.actorId,
        })),
    });
  }
  async create(userId: string, input: DisputeCreateInput) {
    try {
      const p = disputeCreateInputSchema.parse(input);
      const c = loadApiConfig(process.env);
      const d = await this.repo.create(
        userId,
        p,
        c.disputeWindowHours,
        c.disputeShippedMinAgeHours,
      );
      this.events.publish({
        actorId: userId,
        disputeId: d.id,
        name: 'dispute_opened',
        orderId: d.orderId,
        targetUserId: d.counterpartyId,
      });
      return this.detail(d);
    } catch (e) {
      throw mapDisputeError(e);
    }
  }
  async get(userId: string, id: string) {
    try {
      const d = await this.repo.participant(userId, id);
      if (!d) throw new DisputeDomainError('DISPUTE_NOT_FOUND');
      return this.detail(d);
    } catch (e) {
      throw mapDisputeError(e);
    }
  }
  async list(userId: string) {
    try {
      return disputePageSchema.parse({
        items: (await this.repo.listParticipant(userId)).map((d) => this.summary(d)),
        nextCursor: null,
      });
    } catch (e) {
      throw mapDisputeError(e);
    }
  }
  async upload(userId: string, id: string, file: UploadedListingImage | undefined) {
    let key: string | undefined;
    try {
      const processed = await this.processor.process(file);
      key = `disputes/${id}/${randomUUID()}.webp`;
      await this.storage.upload(key, processed.body);
      const retention = loadApiConfig(process.env).disputeEvidenceRetentionDays;
      const e = await this.repo.addEvidence(userId, id, {
        storageKey: key,
        width: processed.width,
        height: processed.height,
        ...(retention ? { retainedUntil: new Date(Date.now() + retention * 86400000) } : {}),
      });
      this.events.publish({ actorId: userId, disputeId: id, name: 'dispute_evidence_added' });
      const urls = await this.storage.signedUrls([key]);
      return {
        id: e.id,
        width: e.width,
        height: e.height,
        createdAt: e.createdAt.toISOString(),
        url: urls.get(key),
      };
    } catch (e) {
      if (key)
        try {
          await this.storage.remove([key]);
        } catch {
          // The original upload error remains authoritative; cleanup is best effort.
        }
      throw mapDisputeError(e);
    }
  }
  async adminGet(id: string) {
    try {
      const d = await this.repo.admin(id);
      if (!d) throw new DisputeDomainError('DISPUTE_NOT_FOUND');
      return {
        ...(await this.detail(d, true)),
        openerUsername: d.opener.profile?.username ?? null,
        counterpartyUsername: d.counterparty.profile?.username ?? null,
        safetyActions: d.safetyActions,
        trustAudits: d.trustAudits,
      };
    } catch (e) {
      throw mapDisputeError(e);
    }
  }
  async adminList(input: unknown) {
    try {
      const q = disputeQuerySchema.parse(input);
      return disputePageSchema.parse({
        items: (await this.repo.listAdmin(q.status, q.query, q.limit)).map((d) => this.summary(d)),
        nextCursor: null,
      });
    } catch (e) {
      throw mapDisputeError(e);
    }
  }
  async action(adminId: string, id: string, input: DisputeAdminAction) {
    try {
      const p = disputeAdminActionSchema.parse(input);
      const d = await this.repo.action(adminId, id, p);
      if (['RESOLVE', 'REJECT'].includes(p.action))
        this.events.publish({ actorId: adminId, disputeId: id, name: 'dispute_resolved' });
      return this.detail(d, true);
    } catch (e) {
      throw mapDisputeError(e);
    }
  }
}
