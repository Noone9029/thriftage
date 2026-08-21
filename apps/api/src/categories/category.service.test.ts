import type { Category as CategoryRecord } from '@thriftage/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryRepository } from './category.repository';
import { CategoryService } from './category.service';

const now = new Date('2026-08-21T12:00:00.000Z');
const parent: CategoryRecord = {
  createdAt: now,
  description: 'Parent category',
  id: 'c2b6ba70-f70c-4550-84d1-f596cb62f4b7',
  isActive: true,
  name: 'Clothing',
  parentId: null,
  slug: 'clothing',
  sortOrder: 10,
  updatedAt: now,
};
const child: CategoryRecord = {
  ...parent,
  description: 'Child category',
  id: '2541daa0-d341-4555-b3c1-8adfc43f359f',
  name: 'Tops',
  parentId: parent.id,
  slug: 'tops',
};

describe('CategoryService', () => {
  const repository = {
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  };
  const service = new CategoryService(repository as unknown as CategoryRepository);

  beforeEach(() => vi.clearAllMocks());

  it('serializes Prisma records without leaking or rejecting persistence timestamps', async () => {
    repository.list.mockResolvedValue([parent, child]);

    await expect(service.listPublic()).resolves.toEqual([
      {
        children: [
          {
            children: [],
            description: child.description,
            id: child.id,
            isActive: true,
            name: child.name,
            parentId: parent.id,
            slug: child.slug,
            sortOrder: child.sortOrder,
          },
        ],
        description: parent.description,
        id: parent.id,
        isActive: true,
        name: parent.name,
        parentId: null,
        slug: parent.slug,
        sortOrder: parent.sortOrder,
      },
    ]);
  });

  it('uses the same privacy-safe serialization for admin listing and mutations', async () => {
    repository.list.mockResolvedValue([parent]);
    repository.create.mockResolvedValue(parent);
    repository.update.mockResolvedValue(parent);

    const expected = {
      description: parent.description,
      id: parent.id,
      isActive: true,
      name: parent.name,
      parentId: null,
      slug: parent.slug,
      sortOrder: parent.sortOrder,
    };
    await expect(service.listAdmin()).resolves.toEqual([expected]);
    await expect(
      service.create('actor-id', { name: 'Clothing', slug: 'clothing', sortOrder: 10 }),
    ).resolves.toEqual(expected);
    await expect(service.update('actor-id', parent.id, { name: 'Clothing' })).resolves.toEqual(
      expected,
    );
  });
});
