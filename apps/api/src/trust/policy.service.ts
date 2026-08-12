import { Inject, Injectable } from '@nestjs/common';
import {
  currentPolicyPageSchema,
  policyAcceptanceInputSchema,
  policyPublishInputSchema,
  policyVersionSchema,
  type CurrentPolicyPage,
  type PolicyAcceptanceInput,
  type PolicyPublishInput,
} from '@thriftage/shared';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { PolicyRepository } from './policy.repository';
import { mapTrustError, TrustDomainError } from './trust.errors';

@Injectable()
export class PolicyService {
  public constructor(
    @Inject(PolicyRepository) private readonly repository: PolicyRepository,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
  ) {}
  private serialize(r: {
    id: string;
    policyType: 'TERMS_OF_USE' | 'PRIVACY_POLICY' | 'COMMUNITY_GUIDELINES';
    version: string;
    title: string;
    url: string;
    effectiveAt: Date;
    publishedAt: Date;
    requiredForUgc: boolean;
  }) {
    return policyVersionSchema.parse({
      ...r,
      effectiveAt: r.effectiveAt.toISOString(),
      publishedAt: r.publishedAt.toISOString(),
    });
  }
  public async current(userId: string): Promise<CurrentPolicyPage> {
    try {
      const records = await this.repository.current(userId);
      const items = records.map((r) => ({
        ...this.serialize(r),
        accepted: 'acceptances' in r && Array.isArray(r.acceptances) && r.acceptances.length > 0,
      }));
      return currentPolicyPageSchema.parse({
        items,
        acceptedForUgc: items.filter((x) => x.requiredForUgc).every((x) => x.accepted),
      });
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async assertUgcAccepted(userId: string) {
    const s = await this.current(userId);
    if (s.items.length > 0 && !s.acceptedForUgc)
      throw mapTrustError(new TrustDomainError('POLICY_ACCEPTANCE_REQUIRED'));
  }
  public async accept(userId: string, input: PolicyAcceptanceInput) {
    try {
      const p = policyAcceptanceInputSchema.parse(input);
      const current = await this.repository.current();
      const required = current.filter((x) => x.requiredForUgc).map((x) => x.id);
      if (required.some((id) => !p.policyVersionIds.includes(id)))
        throw new TrustDomainError('POLICY_ACCEPTANCE_REQUIRED');
      await this.repository.accept(userId, p.policyVersionIds);
      this.events.publish({ actorId: userId, name: 'policy_accepted' });
      return this.current(userId);
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async publish(adminId: string, input: PolicyPublishInput) {
    try {
      return this.serialize(
        await this.repository.publish(adminId, policyPublishInputSchema.parse(input)),
      );
    } catch (e) {
      throw mapTrustError(e);
    }
  }
}
