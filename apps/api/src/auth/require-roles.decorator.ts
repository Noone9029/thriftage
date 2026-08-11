import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@thriftage/shared';

export const REQUIRED_ROLES_METADATA = 'thriftage.required-roles';

export const RequireRoles = (...roles: readonly UserRole[]) =>
  SetMetadata(REQUIRED_ROLES_METADATA, roles);
