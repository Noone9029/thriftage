import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@thriftage/db';
import {
  disputeAdminActionSchema,
  disputeCreateInputSchema,
  type DisputeAdminAction,
  type DisputeCreateInput,
} from '@thriftage/shared';
import { z } from 'zod';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  MAX_LISTING_IMAGE_BYTES,
  type UploadedListingImage,
} from '../listing-media/listing-image-processor';
import { ListingImageUploadFilter } from '../listing-media/listing-image-upload.filter';
import { DisputeService } from './dispute.service';
const uuid = new ZodValidationPipe(z.string().uuid());
@Controller('disputes')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class DisputeController {
  constructor(@Inject(DisputeService) private readonly s: DisputeService) {}
  @Post() create(
    @CurrentUser() u: User,
    @Body(new ZodValidationPipe(disputeCreateInputSchema)) i: DisputeCreateInput,
  ) {
    return this.s.create(u.id, i);
  }
  @Get() list(@CurrentUser() u: User) {
    return this.s.list(u.id);
  }
  @Get(':id') get(@CurrentUser() u: User, @Param('id', uuid) id: string) {
    return this.s.get(u.id, id);
  }
  @Post(':id/evidence')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_LISTING_IMAGE_BYTES, files: 1 } }),
  )
  @UseFilters(ListingImageUploadFilter)
  upload(
    @CurrentUser() u: User,
    @Param('id', uuid) id: string,
    @UploadedFile() f: Express.Multer.File | undefined,
  ) {
    return this.s.upload(u.id, id, f as UploadedListingImage | undefined);
  }
}
@Controller('admin/disputes')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminDisputeController {
  constructor(@Inject(DisputeService) private readonly s: DisputeService) {}
  @Get() list(@Query() q: unknown) {
    return this.s.adminList(q);
  }
  @Get(':id') get(@Param('id', uuid) id: string) {
    return this.s.adminGet(id);
  }
  @Post(':id/actions') action(
    @CurrentUser() a: User,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(disputeAdminActionSchema)) i: DisputeAdminAction,
  ) {
    return this.s.action(a.id, id, i);
  }
}
