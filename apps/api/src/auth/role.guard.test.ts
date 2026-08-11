import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '@thriftage/db';
import { describe, expect, it } from 'vitest';

import { RoleGuard } from './role.guard';

const user = { role: 'USER' } as User;

function contextFor(currentUser: User | undefined): ExecutionContext {
  return {
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ currentUser }) }),
  } as unknown as ExecutionContext;
}

describe('RoleGuard', () => {
  it('uses the PostgreSQL current user role', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => ['ADMIN'];
    const guard = new RoleGuard(reflector);
    expect(() => guard.canActivate(contextFor(user))).toThrowError(
      expect.objectContaining({ code: 'ADMIN_PERMISSION_DENIED' }),
    );
    expect(guard.canActivate(contextFor({ ...user, role: 'ADMIN' }))).toBe(true);
  });

  it('never accepts a missing linked application user', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => ['ADMIN'];
    expect(() => new RoleGuard(reflector).canActivate(contextFor(undefined))).toThrowError(
      expect.objectContaining({ code: 'ADMIN_PERMISSION_DENIED' }),
    );
  });
});
