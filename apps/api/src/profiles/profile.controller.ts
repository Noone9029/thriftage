import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
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
  profileCreateInputSchema,
  profileUpdateInputSchema,
  usernameAvailabilityQuerySchema,
  usernameSchema,
  type PrivateUserProfile,
  type ProfileCreateInput,
  type ProfileUpdateInput,
  type PublicUserProfile,
  type UsernameAvailability,
} from '@thriftage/shared';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MAX_PROFILE_IMAGE_BYTES } from './profile-image-processor';
import type { UploadedProfileImage } from './profile-image-processor';
import { ProfileImageService } from './profile-image.service';
import { ProfileImageUploadFilter } from './profile-image-upload.filter';
import { ProfileService } from './profile.service';

@Controller('profiles')
export class ProfileController {
  public constructor(
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Inject(ProfileImageService) private readonly images: ProfileImageService,
  ) {}

  @Get('username-availability')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public availability(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(usernameAvailabilityQuerySchema)) query: { username: string },
  ): Promise<UsernameAvailability> {
    return this.profiles.availability(query.username, user.id);
  }

  @Get('me')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public getMine(@CurrentUser() user: User): Promise<PrivateUserProfile> {
    return this.profiles.getMine(user.id);
  }

  @Post()
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(profileCreateInputSchema)) input: ProfileCreateInput,
  ): Promise<PrivateUserProfile> {
    return this.profiles.create(user.id, input);
  }

  @Patch('me')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public update(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(profileUpdateInputSchema)) input: ProfileUpdateInput,
  ): Promise<PrivateUserProfile> {
    return this.profiles.update(user.id, input);
  }

  @Post('me/image')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_PROFILE_IMAGE_BYTES, files: 1 } }),
  )
  @UseFilters(ProfileImageUploadFilter)
  public uploadImage(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PrivateUserProfile> {
    return this.images.upload(user.id, file as UploadedProfileImage | undefined);
  }

  @Delete('me/image')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  @HttpCode(HttpStatus.OK)
  public removeImage(@CurrentUser() user: User): Promise<PrivateUserProfile> {
    return this.images.remove(user.id);
  }

  @Get(':username')
  public getPublic(
    @Param('username', new ZodValidationPipe(usernameSchema)) username: string,
  ): Promise<PublicUserProfile> {
    return this.profiles.getPublic(username);
  }
}
