import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  categoryCreateInputSchema,
  categoryUpdateInputSchema,
  type Category,
  type CategoryCreateInput,
  type CategoryTreeNode,
  type CategoryUpdateInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CategoryService } from './category.service';

@Controller('categories')
export class PublicCategoryController {
  public constructor(@Inject(CategoryService) private readonly categories: CategoryService) {}

  @Get()
  public list(): Promise<readonly CategoryTreeNode[]> {
    return this.categories.listPublic();
  }
}

@Controller('admin/categories')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminCategoryController {
  public constructor(@Inject(CategoryService) private readonly categories: CategoryService) {}

  @Get()
  public list(): Promise<readonly Category[]> {
    return this.categories.listAdmin();
  }

  @Post()
  public create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(categoryCreateInputSchema)) input: CategoryCreateInput,
  ): Promise<Category> {
    return this.categories.create(user.id, input);
  }

  @Patch(':categoryId')
  public update(
    @CurrentUser() user: User,
    @Param('categoryId', new ZodValidationPipe(z.string().uuid())) categoryId: string,
    @Body(new ZodValidationPipe(categoryUpdateInputSchema)) input: CategoryUpdateInput,
  ): Promise<Category> {
    return this.categories.update(user.id, categoryId, input);
  }
}
