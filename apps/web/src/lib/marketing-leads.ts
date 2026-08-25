import 'server-only';

import { createHmac } from 'node:crypto';

import { getPrismaClient, Prisma, type MarketingLead, type PrismaClient } from '@thriftage/db';
import {
  betaInterestInputSchema,
  sellerInterestInputSchema,
  type BetaInterestInput,
  type MarketingLeadReceipt,
  type SellerInterestInput,
} from '@thriftage/shared';

import { parseMarketingEnvironment } from './marketing-environment';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1_000;
const RATE_LIMIT_REQUESTS = 5;
const SERVERLESS_DATABASE_POOL_MAX = 3;

export class MarketingLeadRateLimitError extends Error {
  public constructor() {
    super('MARKETING_LEAD_RATE_LIMITED');
  }
}

export class MarketingLeadUnavailableError extends Error {
  public constructor() {
    super('MARKETING_LEAD_UNAVAILABLE');
  }
}

function logMarketingLeadFailure(error: unknown): void {
  const diagnostic =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? { code: error.code, name: error.name }
      : {
          code: 'UNEXPECTED',
          name: error instanceof Error ? error.name : 'UnknownError',
        };

  console.error(
    JSON.stringify({
      event: 'marketing_lead_store_failed',
      ...diagnostic,
    }),
  );
}

export function hashMarketingFingerprint(fingerprint: string, secret: string): string {
  return createHmac('sha256', secret).update(fingerprint).digest('hex');
}

type LeadInput =
  | { readonly input: BetaInterestInput; readonly kind: 'BETA' }
  | { readonly input: SellerInterestInput; readonly kind: 'SELLER' };

export class MarketingLeadStore {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly maxRequests = RATE_LIMIT_REQUESTS,
    private readonly windowMs = FIFTEEN_MINUTES_MS,
  ) {}

  public async submit(
    lead: LeadInput,
    fingerprintHash: string,
    now = new Date(),
  ): Promise<MarketingLeadReceipt> {
    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const bucketStart = new Date(Math.floor(now.getTime() / this.windowMs) * this.windowMs);
        const bucket = await transaction.marketingLeadRateLimitBucket.upsert({
          create: {
            bucketStart,
            expiresAt: new Date(bucketStart.getTime() + this.windowMs * 2),
            fingerprintHash,
          },
          update: { requestCount: { increment: 1 } },
          where: { fingerprintHash_bucketStart: { bucketStart, fingerprintHash } },
        });

        if (bucket.requestCount > this.maxRequests) return 'RATE_LIMITED' as const;

        const existing = await transaction.marketingLead.findUnique({
          select: { id: true },
          where: {
            kind_emailNormalized: {
              emailNormalized: lead.input.email,
              kind: lead.kind,
            },
          },
        });
        if (existing !== null) return 'ALREADY_REGISTERED' as const;

        await transaction.marketingLead.create({ data: this.data(lead) });
        await transaction.marketingLeadRateLimitBucket.deleteMany({
          where: { expiresAt: { lt: now } },
        });
        return 'CREATED' as const;
      });

      if (result === 'RATE_LIMITED') throw new MarketingLeadRateLimitError();
      return { status: result };
    } catch (error: unknown) {
      if (error instanceof MarketingLeadRateLimitError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { status: 'ALREADY_REGISTERED' };
      }
      logMarketingLeadFailure(error);
      throw new MarketingLeadUnavailableError();
    }
  }

  private data(lead: LeadInput): Prisma.MarketingLeadCreateInput {
    if (lead.kind === 'BETA') {
      return {
        audience: lead.input.audience,
        city: lead.input.city,
        emailNormalized: lead.input.email,
        kind: lead.kind,
        source: lead.input.source,
        ...(lead.input.styleInterest === undefined
          ? {}
          : { styleInterest: lead.input.styleInterest }),
      };
    }
    return {
      city: lead.input.city,
      emailNormalized: lead.input.email,
      itemVolume: lead.input.itemVolume,
      kind: lead.kind,
      message: lead.input.message ?? null,
      name: lead.input.name,
      sellerType: lead.input.sellerType,
      source: lead.input.source,
      storeUrl: lead.input.storeUrl ?? null,
    };
  }
}

function productionStore(): { readonly secret: string; readonly store: MarketingLeadStore } {
  const parsed = parseMarketingEnvironment(process.env);
  if (!parsed.success) {
    console.error(
      JSON.stringify({
        event: 'marketing_lead_environment_invalid',
        keys: [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].sort(),
      }),
    );
    throw new MarketingLeadUnavailableError();
  }
  return {
    secret: parsed.data.MARKETING_FORM_HASH_SECRET,
    store: new MarketingLeadStore(
      getPrismaClient(parsed.data.DATABASE_URL, { max: SERVERLESS_DATABASE_POOL_MAX }),
    ),
  };
}

export async function submitBetaLead(
  input: unknown,
  fingerprint: string,
): Promise<MarketingLeadReceipt> {
  const validated = betaInterestInputSchema.parse(input);
  const { secret, store } = productionStore();
  return store.submit(
    { input: validated, kind: 'BETA' },
    hashMarketingFingerprint(fingerprint, secret),
  );
}

export async function submitSellerLead(
  input: unknown,
  fingerprint: string,
): Promise<MarketingLeadReceipt> {
  const validated = sellerInterestInputSchema.parse(input);
  const { secret, store } = productionStore();
  return store.submit(
    { input: validated, kind: 'SELLER' },
    hashMarketingFingerprint(fingerprint, secret),
  );
}

export type { MarketingLead };
