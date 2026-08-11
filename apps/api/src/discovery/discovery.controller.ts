import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { User } from '@thriftage/db';
import { feedQuerySchema, type FeedQuery, type ListingPage } from '@thriftage/shared';

import { OptionalCurrentUser } from '../auth/current-auth.decorators';
import { OptionalAuthenticationGuard } from '../auth/optional-authentication.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DiscoveryService } from './discovery.service';

@Controller('feed')
@UseGuards(OptionalAuthenticationGuard)
export class DiscoveryController {
  public constructor(@Inject(DiscoveryService) private readonly discovery: DiscoveryService) {}

  @Get()
  public feed(
    @OptionalCurrentUser() viewer: User | undefined,
    @Query(new ZodValidationPipe(feedQuerySchema)) query: FeedQuery,
  ): Promise<ListingPage> {
    return this.discovery.feed(query, viewer?.id);
  }
}
