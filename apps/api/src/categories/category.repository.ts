import { Injectable } from '@nestjs/common';
import { getPrismaClient, type Category, type PrismaClient } from '@thriftage/db';
import type { CategoryCreateInput, CategoryUpdateInput } from '@thriftage/shared';

import { MarketplaceDomainError } from '../common/marketplace.errors';

@Injectable()
export class CategoryRepository {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public list(activeOnly: boolean): Promise<Category[]> {
    return this.client.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      ...(activeOnly ? { where: { isActive: true } } : {}),
    });
  }

  public async create(actorId: string, input: CategoryCreateInput): Promise<Category> {
    return this.client.$transaction(async (transaction) => {
      if (input.parentId !== undefined && input.parentId !== null) {
        const parent = await transaction.category.findUnique({ where: { id: input.parentId } });
        if (parent === null) throw new MarketplaceDomainError('CATEGORY_NOT_FOUND');
        if (!parent.isActive) throw new MarketplaceDomainError('CATEGORY_UNAVAILABLE');
      }
      try {
        const category = await transaction.category.create({
          data: {
            ...(input.description === undefined ? {} : { description: input.description }),
            name: input.name,
            ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
            slug: input.slug,
            sortOrder: input.sortOrder,
          },
        });
        await transaction.moderationAudit.create({
          data: {
            action: 'CATEGORY_CREATED',
            actorId,
            categoryId: category.id,
            nextState: category.isActive ? 'ACTIVE' : 'INACTIVE',
          },
        });
        return category;
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new MarketplaceDomainError('CATEGORY_SLUG_UNAVAILABLE');
        }
        throw error;
      }
    });
  }

  public async update(
    actorId: string,
    categoryId: string,
    input: CategoryUpdateInput,
  ): Promise<Category> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.category.findUnique({ where: { id: categoryId } });
      if (existing === null) throw new MarketplaceDomainError('CATEGORY_NOT_FOUND');
      if (input.isActive === false && existing.isActive) {
        const [activeListings, activeChildren] = await Promise.all([
          transaction.listing.count({ where: { categoryId, status: 'ACTIVE' } }),
          transaction.category.count({ where: { isActive: true, parentId: categoryId } }),
        ]);
        if (activeListings > 0 || activeChildren > 0) {
          throw new MarketplaceDomainError('CATEGORY_IN_USE');
        }
      }
      try {
        const category = await transaction.category.update({
          data: {
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.slug === undefined ? {} : { slug: input.slug }),
            ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          },
          where: { id: categoryId },
        });
        const action =
          input.isActive === undefined || input.isActive === existing.isActive
            ? 'CATEGORY_UPDATED'
            : input.isActive
              ? 'CATEGORY_ACTIVATED'
              : 'CATEGORY_DEACTIVATED';
        await transaction.moderationAudit.create({
          data: {
            action,
            actorId,
            categoryId,
            nextState: category.isActive ? 'ACTIVE' : 'INACTIVE',
            previousState: existing.isActive ? 'ACTIVE' : 'INACTIVE',
          },
        });
        return category;
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new MarketplaceDomainError('CATEGORY_SLUG_UNAVAILABLE');
        }
        throw error;
      }
    });
  }
}
