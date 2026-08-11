import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminCategoryController, PublicCategoryController } from './category.controller';
import { CategoryRepository } from './category.repository';
import { CategoryService } from './category.service';

@Module({
  controllers: [AdminCategoryController, PublicCategoryController],
  exports: [CategoryService],
  imports: [AuthModule],
  providers: [
    { provide: CategoryRepository, useFactory: () => new CategoryRepository() },
    CategoryService,
  ],
})
export class CategoriesModule {}
