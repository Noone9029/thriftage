import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client/client';

interface CachedPrismaClient {
  readonly client: PrismaClient;
  readonly databaseUrl: string;
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

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: requireDatabaseUrl(databaseUrl) });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  const resolvedDatabaseUrl = requireDatabaseUrl(databaseUrl);

  if (process.env.NODE_ENV === 'production') {
    if (productionPrisma === undefined) {
      productionPrisma = {
        client: createPrismaClient(resolvedDatabaseUrl),
        databaseUrl: resolvedDatabaseUrl,
      };
    } else if (productionPrisma.databaseUrl !== resolvedDatabaseUrl) {
      throw new Error('Refusing to reuse the production Prisma client with a different database.');
    }

    return productionPrisma.client;
  }

  const cached = globalForPrisma.__thriftagePrisma;
  if (cached !== undefined) {
    if (cached.databaseUrl !== resolvedDatabaseUrl) {
      throw new Error('Refusing to reuse the development Prisma client with a different database.');
    }

    return cached.client;
  }

  const client = createPrismaClient(resolvedDatabaseUrl);
  globalForPrisma.__thriftagePrisma = { client, databaseUrl: resolvedDatabaseUrl };
  return client;
}
