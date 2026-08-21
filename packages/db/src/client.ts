import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client/client';

interface CachedPrismaClient {
  readonly client: PrismaClient;
  readonly databaseUrl: string;
  readonly poolMax: number;
}

export interface PrismaClientPoolOptions {
  readonly max?: number;
}

const globalForPrisma = globalThis as typeof globalThis & {
  __thriftagePrisma?: CachedPrismaClient;
};

let productionPrisma: CachedPrismaClient | undefined;

function requireDatabaseUrl(databaseUrl: string | undefined): string {
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is required to create a Prisma client.');
  }

  return databaseUrl;
}

function resolvePoolMax(max: number | undefined): number {
  const resolved = max ?? 10;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 100) {
    throw new Error('Database pool max must be an integer between 1 and 100.');
  }
  return resolved;
}

export function createPrismaClient(
  databaseUrl: string,
  poolOptions: PrismaClientPoolOptions = {},
): PrismaClient {
  const poolMax = resolvePoolMax(poolOptions.max);
  const adapter = new PrismaPg({
    connectionString: requireDatabaseUrl(databaseUrl),
    max: poolMax,
  });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(
  databaseUrl = process.env.DATABASE_URL,
  poolOptions: PrismaClientPoolOptions = {},
): PrismaClient {
  const resolvedDatabaseUrl = requireDatabaseUrl(databaseUrl);
  const poolMax = resolvePoolMax(poolOptions.max);

  if (process.env.NODE_ENV === 'production') {
    if (productionPrisma === undefined) {
      productionPrisma = {
        client: createPrismaClient(resolvedDatabaseUrl, { max: poolMax }),
        databaseUrl: resolvedDatabaseUrl,
        poolMax,
      };
    } else if (productionPrisma.databaseUrl !== resolvedDatabaseUrl) {
      throw new Error('Refusing to reuse the production Prisma client with a different database.');
    } else if (poolOptions.max !== undefined && productionPrisma.poolMax !== poolMax) {
      throw new Error('Refusing to reuse the production Prisma client with a different pool size.');
    }

    return productionPrisma.client;
  }

  const cached = globalForPrisma.__thriftagePrisma;
  if (cached !== undefined) {
    if (cached.databaseUrl !== resolvedDatabaseUrl) {
      throw new Error('Refusing to reuse the development Prisma client with a different database.');
    }
    if (poolOptions.max !== undefined && cached.poolMax !== poolMax) {
      throw new Error(
        'Refusing to reuse the development Prisma client with a different pool size.',
      );
    }

    return cached.client;
  }

  const client = createPrismaClient(resolvedDatabaseUrl, { max: poolMax });
  globalForPrisma.__thriftagePrisma = { client, databaseUrl: resolvedDatabaseUrl, poolMax };
  return client;
}
