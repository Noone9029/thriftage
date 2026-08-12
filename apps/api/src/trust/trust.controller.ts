import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import type { User } from '@thriftage/db';
import {
  policyAcceptanceInputSchema,
  policyPublishInputSchema,
  restrictionInputSchema,
  safetyActionInputSchema,
  type PolicyAcceptanceInput,
  type PolicyPublishInput,
  type RestrictionInput,
  type SafetyActionInput,
} from '@thriftage/shared';
import { z } from 'zod';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PolicyService } from './policy.service';
import { SafetyService } from './safety.service';

const uuid = new ZodValidationPipe(z.string().uuid());
@Controller()
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class TrustController {
  public constructor(
    @Inject(SafetyService) private readonly safety: SafetyService,
    @Inject(PolicyService) private readonly policies: PolicyService,
  ) {}
  @Post('blocks/:userId') block(@CurrentUser() u: User, @Param('userId', uuid) id: string) {
    return this.safety.block(u.id, id);
  }
  @Delete('blocks/:userId') unblock(@CurrentUser() u: User, @Param('userId', uuid) id: string) {
    return this.safety.unblock(u.id, id);
  }
  @Get('blocks') blocks(@CurrentUser() u: User) {
    return this.safety.blocks(u.id);
  }
  @Get('safety/me') status(@CurrentUser() u: User) {
    return this.safety.status(u.id, loadApiConfig(process.env).supportUrl);
  }
  @Get('policies/current') current(@CurrentUser() u: User) {
    return this.policies.current(u.id);
  }
  @Post('policies/accept') accept(
    @CurrentUser() u: User,
    @Body(new ZodValidationPipe(policyAcceptanceInputSchema)) i: PolicyAcceptanceInput,
  ) {
    return this.policies.accept(u.id, i);
  }
}

@Controller('admin/trust')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminTrustController {
  public constructor(
    @Inject(SafetyService) private readonly safety: SafetyService,
    @Inject(PolicyService) private readonly policies: PolicyService,
  ) {}
  @Get('metrics') metrics() {
    return this.safety.metrics();
  }
  @Get('users') users(@Query() query: unknown) {
    return this.safety.adminUsers(query);
  }
  @Get('users/:userId') user(@Param('userId', uuid) id: string) {
    return this.safety.adminUser(id);
  }
  @Post('users/:userId/restrictions') restrict(
    @CurrentUser() a: User,
    @Param('userId', uuid) id: string,
    @Body(new ZodValidationPipe(restrictionInputSchema)) i: RestrictionInput,
  ) {
    return this.safety.restrict(a.id, id, i);
  }
  @Post('restrictions/:id/revoke') revoke(
    @CurrentUser() a: User,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(z.strictObject({ reason: z.string().trim().min(3).max(1000) })))
    i: { reason: string },
  ) {
    return this.safety.revoke(a.id, id, i.reason);
  }
  @Post('users/:userId/actions') action(
    @CurrentUser() a: User,
    @Param('userId', uuid) id: string,
    @Body(new ZodValidationPipe(safetyActionInputSchema)) i: SafetyActionInput,
  ) {
    return this.safety.action(a.id, id, i);
  }
  @Post('policies') publish(
    @CurrentUser() a: User,
    @Body(new ZodValidationPipe(policyPublishInputSchema)) i: PolicyPublishInput,
  ) {
    return this.policies.publish(a.id, i);
  }
}
