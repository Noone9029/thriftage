import { Inject, Injectable, Logger } from '@nestjs/common';
import { getPrismaClient, type User } from '@thriftage/db';
import {
  authProviderUserIdSchema,
  emailAddressSchema,
  phoneNumberSchema,
  provisionUserInputSchema,
  type ProvisionUserInput,
} from '@thriftage/shared';

import { AuthApiException, mapTokenVerificationError } from './auth.errors';
import {
  AUTHORITATIVE_AUTH_USER_PROVIDER,
  type AuthoritativeAuthUserProvider,
} from './auth-provider.interface';
import type { AuthenticatedRequestContext } from './auth.types';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function parseOptionalProviderValue(
  value: string | null,
  schema: typeof emailAddressSchema | typeof phoneNumberSchema,
): string | null {
  if (value === null) {
    return null;
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AuthApiException('AUTH_INVALID_TOKEN');
  }
  return parsed.data;
}

const provisioningTails = new Map<string, Promise<void>>();

async function serializeProvisioning<T>(subject: string, operation: () => Promise<T>): Promise<T> {
  const previous = provisioningTails.get(subject) ?? Promise.resolve();
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  provisioningTails.set(subject, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (provisioningTails.get(subject) === tail) provisioningTails.delete(subject);
  }
}

@Injectable()
export class ProvisionUserService {
  private readonly logger = new Logger(ProvisionUserService.name);

  public constructor(
    @Inject(AUTHORITATIVE_AUTH_USER_PROVIDER)
    private readonly authUserProvider: AuthoritativeAuthUserProvider,
  ) {}

  public async provision(
    context: AuthenticatedRequestContext,
    input: ProvisionUserInput,
  ): Promise<User> {
    const validatedInput = provisionUserInputSchema.parse(input);
    let authoritativeUser;
    try {
      authoritativeUser = await this.authUserProvider.getUser(context.accessToken);
    } catch (error: unknown) {
      throw mapTokenVerificationError(error);
    }

    const parsedSubject = authProviderUserIdSchema.safeParse(authoritativeUser.authProviderUserId);
    if (!parsedSubject.success || parsedSubject.data !== context.identity.authProviderUserId) {
      throw new AuthApiException('AUTH_INVALID_TOKEN');
    }

    const email = parseOptionalProviderValue(authoritativeUser.email, emailAddressSchema);
    const phone = parseOptionalProviderValue(authoritativeUser.phone, phoneNumberSchema);
    if (email === null || !authoritativeUser.emailVerified) {
      throw new AuthApiException('AUTH_EMAIL_UNVERIFIED');
    }
    const prisma = getPrismaClient();

    return serializeProvisioning(parsedSubject.data, async () => {
      try {
        return await prisma.user.upsert({
          create: {
            authProviderUserId: parsedSubject.data,
            email,
            emailVerified: authoritativeUser.emailVerified,
            fullName: validatedInput.fullName,
            phone,
            phoneVerified: authoritativeUser.phoneVerified,
          },
          update: {},
          where: { authProviderUserId: parsedSubject.data },
        });
      } catch (error: unknown) {
        if (!isUniqueConstraintError(error)) throw error;

        const sameIdentity = await prisma.user.findUnique({
          where: { authProviderUserId: parsedSubject.data },
        });
        if (sameIdentity !== null) return sameIdentity;

        this.logger.warn(
          `Provisioning identity collision: authProviderUserId=${parsedSubject.data}`,
        );
        throw new AuthApiException('AUTH_IDENTITY_CONFLICT');
      }
    });
  }
}
