import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminAccess } from '@thriftage/shared';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RoleGuard } from '../auth/role.guard';

@Controller('admin')
@UseGuards(AuthenticationGuard, LinkedUserGuard, RoleGuard)
@RequireRoles('ADMIN')
export class AdminAccessController {
  @Get('access')
  public access(): AdminAccess {
    return { authorized: true, role: 'ADMIN' };
  }
}
