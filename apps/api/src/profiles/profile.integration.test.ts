import { randomUUID } from 'node:crypto';

import { createPrismaClient, type Prisma, type PrismaClient, type User } from '@thriftage/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) throw new Error('TEST_DATABASE_URL is required.');
const prisma = createPrismaClient(testDatabaseUrl);

function userData(overrides: Partial<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
  const unique = randomUUID();
  return {
    authProviderUserId: `profile-provider-${unique}`,
    email: `${unique}@example.com`,
    emailVerified: true,
    fullName: 'Profile Integration User',
    phone: `+92${unique.replaceAll('-', '').slice(0, 10)}`,
    phoneVerified: true,
    ...overrides,
  };
}

async function clear(client: PrismaClient): Promise<void> {
  await client.phoneVerificationAttempt.deleteMany();
  await client.profile.deleteMany();
  await client.user.deleteMany();
}

describe.sequential('Profile PostgreSQL integration', () => {
  let repository: ProfileRepository;
  let service: ProfileService;

  beforeAll(async () => {
    await prisma.$connect();
    repository = new ProfileRepository(prisma);
    service = new ProfileService(repository);
  });
  afterEach(async () => clear(prisma));
  afterAll(async () => {
    await clear(prisma);
    await prisma.$disconnect();
  });

  async function createUser(overrides: Partial<Prisma.UserCreateInput> = {}): Promise<User> {
    return prisma.user.create({ data: userData(overrides) });
  }

  it('creates, retrieves, and updates only the authenticated owner profile', async () => {
    const owner = await createUser();
    const other = await createUser();
    await service.create(owner.id, { bio: 'First bio', username: 'owner_name' });
    await service.create(other.id, { username: 'other_name' });

    await expect(service.update(owner.id, { bio: 'Updated bio' })).resolves.toMatchObject({
      bio: 'Updated bio',
      username: 'owner_name',
    });
    await expect(service.getMine(other.id)).resolves.toMatchObject({ username: 'other_name' });
    await expect(prisma.profile.findUnique({ where: { userId: other.id } })).resolves.toMatchObject(
      {
        bio: null,
      },
    );
  });

  it('uses database uniqueness as the final concurrent username boundary', async () => {
    const first = await createUser();
    const second = await createUser();
    const results = await Promise.allSettled([
      service.create(first.id, { username: 'contested_name' }),
      service.create(second.id, { username: 'contested_name' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma.profile.count({ where: { username: 'contested_name' } })).resolves.toBe(1);
  });

  it('hides suspended and deactivated profiles from public retrieval', async () => {
    const user = await createUser();
    await service.create(user.id, { username: 'hidden_name' });
    await prisma.user.update({ data: { accountStatus: 'SUSPENDED' }, where: { id: user.id } });
    await expect(service.getPublic('hidden_name')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
    await prisma.user.update({ data: { accountStatus: 'DEACTIVATED' }, where: { id: user.id } });
    await expect(service.getPublic('hidden_name')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });

  it('persists generated image metadata without changing role or account status', async () => {
    const user = await createUser({ role: 'ADMIN' });
    await service.create(user.id, { username: 'admin_profile' });
    const key = `profiles/${user.id}/${randomUUID()}.webp`;
    await repository.setImage(user.id, key, 'https://project.supabase.co/storage/avatar.webp');
    await expect(prisma.profile.findUnique({ where: { userId: user.id } })).resolves.toMatchObject({
      profileImageKey: key,
    });
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      accountStatus: 'ACTIVE',
      role: 'ADMIN',
    });
  });
});
