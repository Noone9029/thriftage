import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '@thriftage/db';

import type {
  AuthenticatedHttpRequest,
  AuthenticatedIdentity,
  AuthenticatedRequestContext,
} from './auth.types';

function getRequest(context: ExecutionContext): AuthenticatedHttpRequest {
  return context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
}

export const CurrentAuthIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedIdentity => {
    const authContext = getRequest(context).authContext;
    if (authContext === undefined) {
      throw new Error('Authenticated identity is unavailable. Apply AuthenticationGuard first.');
    }

    return authContext.identity;
  },
);

export const CurrentAuthContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequestContext => {
    const authContext = getRequest(context).authContext;
    if (authContext === undefined) {
      throw new Error('Authentication context is unavailable. Apply AuthenticationGuard first.');
    }

    return authContext;
  },
);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const currentUser = getRequest(context).currentUser;
    if (currentUser === undefined) {
      throw new Error('Application user is unavailable. Apply LinkedUserGuard first.');
    }

    return currentUser;
  },
);

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User | undefined => getRequest(context).currentUser,
);
