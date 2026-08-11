import { Inject, Injectable } from '@nestjs/common';
import {
  categoryCreateInputSchema,
  categorySchema,
  categoryTreeNodeSchema,
  categoryUpdateInputSchema,
  type Category,
  type CategoryCreateInput,
  type CategoryTreeNode,
  type CategoryUpdateInput,
} from '@thriftage/shared';

import { mapMarketplaceError } from '../common/marketplace.errors';
import { CategoryRepository } from './category.repository';

@Injectable()
export class CategoryService {
  public constructor(@Inject(CategoryRepository) private readonly repository: CategoryRepository) {}

  public async listPublic(): Promise<readonly CategoryTreeNode[]> {
    try {
      const categories = (await this.repository.list(true)).map((category) =>
        categorySchema.parse(category),
      );
      const byParent = new Map<string | null, Category[]>();
      for (const category of categories) {
        const group = byParent.get(category.parentId) ?? [];
        group.push(category);
        byParent.set(category.parentId, group);
      }
      const build = (parentId: string | null): CategoryTreeNode[] =>
        (byParent.get(parentId) ?? []).map((category) =>
          categoryTreeNodeSchema.parse({ ...category, children: build(category.id) }),
        );
      return build(null);
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async listAdmin(): Promise<readonly Category[]> {
    try {
      return (await this.repository.list(false)).map((category) => categorySchema.parse(category));
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async create(actorId: string, input: CategoryCreateInput): Promise<Category> {
    try {
      return categorySchema.parse(
        await this.repository.create(actorId, categoryCreateInputSchema.parse(input)),
      );
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async update(
    actorId: string,
    categoryId: string,
    input: CategoryUpdateInput,
  ): Promise<Category> {
    try {
      return categorySchema.parse(
        await this.repository.update(actorId, categoryId, categoryUpdateInputSchema.parse(input)),
      );
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }
}
