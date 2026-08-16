import { Inject, Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import {
  sellerVerificationApplyInputSchema,
  sellerVerificationDecisionSchema,
  sellerVerificationEligibilitySchema,
  sellerVerificationQuerySchema,
  sellerVerificationSchema,
  type SellerVerificationApplyInput,
  type SellerVerificationDecision,
} from '@thriftage/shared';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { mapSellerVerificationError, SellerVerificationError } from './seller-verification.errors';
import {
  SellerVerificationRepository,
  type SellerVerificationRecord,
} from './seller-verification.repository';
const explanation =
  'Thriftage Verified means this seller passed the platform account-review process. It does not guarantee every item or eliminate transaction risk.';
@Injectable()
export class SellerVerificationService {
  constructor(
    @Inject(SellerVerificationRepository) private readonly repo: SellerVerificationRepository,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
  ) {}
  private serialize(v: SellerVerificationRecord) {
    return sellerVerificationSchema.parse({
      id: v.id,
      userId: v.userId,
      username: v.user?.profile?.username ?? 'unavailable',
      status: v.status,
      method: v.method,
      statement: v.statement,
      decisionReason: v.decisionReason,
      submittedAt: v.submittedAt.toISOString(),
      reviewedAt: v.reviewedAt?.toISOString() ?? null,
      canReapplyAt: v.canReapplyAt?.toISOString() ?? null,
    });
  }
  async eligibility(userId: string) {
    try {
      const s = await this.repo.eligibility(
        userId,
        loadApiConfig(process.env).sellerVerificationMinCompletedSales,
      );
      return sellerVerificationEligibilitySchema.parse({
        ...s,
        current: s.current ? this.serialize(s.current) : null,
        badgeExplanation: explanation,
      });
    } catch (e) {
      throw mapSellerVerificationError(e);
    }
  }
  async current(userId: string) {
    try {
      const v = await this.repo.current(userId);
      return v ? this.serialize(v) : null;
    } catch (e) {
      throw mapSellerVerificationError(e);
    }
  }
  async apply(userId: string, input: SellerVerificationApplyInput) {
    try {
      if (!loadApiConfig(process.env).sellerVerificationEnabled) {
        throw new SellerVerificationError('VERIFICATION_DISABLED');
      }
      const p = sellerVerificationApplyInputSchema.parse(input);
      const v = await this.repo.apply(
        userId,
        p.statement,
        loadApiConfig(process.env).sellerVerificationMinCompletedSales,
      );
      this.events.publish({
        actorId: userId,
        name: 'seller_verification_submitted',
        sellerVerificationId: v.id,
      });
      return this.serialize(v);
    } catch (e) {
      throw mapSellerVerificationError(e);
    }
  }
  async list(input: unknown) {
    try {
      const q = sellerVerificationQuerySchema.parse(input);
      return {
        items: (await this.repo.list(q.status, q.query, q.limit)).map((v) => this.serialize(v)),
      };
    } catch (e) {
      throw mapSellerVerificationError(e);
    }
  }
  async decide(adminId: string, id: string, input: SellerVerificationDecision) {
    try {
      const p = sellerVerificationDecisionSchema.parse(input);
      const v = await this.repo.decide(
        adminId,
        id,
        p.action,
        p.reason,
        loadApiConfig(process.env).sellerVerificationReapplyDays,
      );
      this.events.publish({
        actorId: adminId,
        name:
          p.action === 'APPROVE' ? 'seller_verification_approved' : 'seller_verification_rejected',
        sellerVerificationId: id,
        targetUserId: v.userId,
      });
      return this.serialize(v);
    } catch (e) {
      throw mapSellerVerificationError(e);
    }
  }
}
