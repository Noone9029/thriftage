import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { ClosedBetaOperations } from '@thriftage/shared';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { ClosedBetaOperationsService } from './closed-beta-operations.service';

@Controller('admin/closed-beta')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class ClosedBetaOperationsController {
  public constructor(
    @Inject(ClosedBetaOperationsService)
    private readonly operations: ClosedBetaOperationsService,
  ) {}

  @Get('snapshot')
  public snapshot(): Promise<ClosedBetaOperations> {
    return this.operations.snapshot();
  }
}
