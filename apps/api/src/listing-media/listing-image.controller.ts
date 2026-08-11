import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@thriftage/db';
import { imageOrderInputSchema, type ListingDetail } from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MAX_LISTING_IMAGE_BYTES, type UploadedListingImage } from './listing-image-processor';
import { ListingImageService } from './listing-image.service';
import { ListingImageUploadFilter } from './listing-image-upload.filter';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('seller/listings/:listingId/images')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class ListingImageController {
  public constructor(@Inject(ListingImageService) private readonly images: ListingImageService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_LISTING_IMAGE_BYTES, files: 1 } }),
  )
  @UseFilters(ListingImageUploadFilter)
  public upload(
    @CurrentUser() user: User,
    @Param('listingId', uuidPipe) listingId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ListingDetail> {
    return this.images.upload(user.id, listingId, file as UploadedListingImage | undefined);
  }

  @Delete(':imageId')
  public remove(
    @CurrentUser() user: User,
    @Param('listingId', uuidPipe) listingId: string,
    @Param('imageId', uuidPipe) imageId: string,
  ): Promise<ListingDetail> {
    return this.images.remove(user.id, listingId, imageId);
  }

  @Patch()
  public reorder(
    @CurrentUser() user: User,
    @Param('listingId', uuidPipe) listingId: string,
    @Body(new ZodValidationPipe(imageOrderInputSchema)) input: unknown,
  ): Promise<ListingDetail> {
    return this.images.reorder(user.id, listingId, input);
  }
}
