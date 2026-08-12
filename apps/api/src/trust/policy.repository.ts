import { Injectable } from '@nestjs/common';
import { getPrismaClient, type PolicyVersion, type PrismaClient } from '@thriftage/db';
import type { PolicyPublishInput } from '@thriftage/shared';
import { TrustDomainError } from './trust.errors';

@Injectable()
export class PolicyRepository {
  public constructor(private readonly prisma?: PrismaClient) {}
  private get client() {
    return this.prisma ?? getPrismaClient();
  }
  public async current(
    userId?: string,
  ): Promise<readonly (PolicyVersion & { acceptances?: readonly { userId: string }[] })[]> {
    return this.client.policyVersion.findMany({
      ...(userId === undefined ? {} : { include: { acceptances: { where: { userId } } } }),
      orderBy: { policyType: 'asc' },
      where: { effectiveAt: { lte: new Date() }, isCurrent: true },
    });
  }
  public async accept(userId: string, ids: readonly string[]) {
    const current = await this.current();
    const valid = new Set(current.map((x) => x.id));
    if (ids.some((id) => !valid.has(id))) throw new TrustDomainError('POLICY_ACCEPTANCE_REQUIRED');
    await this.client.policyAcceptance.createMany({
      data: ids.map((policyVersionId) => ({ policyVersionId, userId })),
      skipDuplicates: true,
    });
  }
  public publish(adminId: string, input: PolicyPublishInput) {
    return this.client.$transaction(async (tx) => {
      await tx.policyVersion.updateMany({
        data: { isCurrent: false },
        where: { isCurrent: true, policyType: input.policyType },
      });
      const policy = await tx.policyVersion.create({
        data: {
          ...input,
          effectiveAt: new Date(input.effectiveAt),
          isCurrent: true,
          publishedById: adminId,
        },
      });
      await tx.trustAudit.create({
        data: {
          action: 'POLICY_PUBLISHED',
          actorId: adminId,
          policyVersionId: policy.id,
          reason: `Published ${input.policyType} ${input.version}.`,
        },
      });
      return policy;
    });
  }
}
