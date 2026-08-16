export type AuthCallbackKind = 'confirmation' | 'recovery';

export type AuthCallbackInstruction =
  | {
      readonly action: 'exchange-code';
      readonly code: string;
      readonly kind: AuthCallbackKind;
    }
  | {
      readonly accessToken: string;
      readonly action: 'set-session';
      readonly kind: AuthCallbackKind;
      readonly refreshToken: string;
    }
  | {
      readonly action: 'verify-otp';
      readonly kind: AuthCallbackKind;
      readonly tokenHash: string;
      readonly type: 'email' | 'magiclink' | 'recovery' | 'signup';
    };

export class AuthCallbackError extends Error {
  public constructor(
    public readonly code: 'INVALID_CALLBACK' | 'PROVIDER_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'AuthCallbackError';
  }
}

const allowedOtpTypes = new Set(['email', 'magiclink', 'recovery', 'signup'] as const);

function nonblank(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

export function parseAuthCallbackUrl(
  input: string,
  allowedScheme = 'thriftage',
): AuthCallbackInstruction {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AuthCallbackError('INVALID_CALLBACK', 'The authentication link is malformed.');
  }

  const isAllowedRoute =
    url.protocol === `${allowedScheme}:` &&
    url.hostname === 'auth' &&
    ['/callback', '/reset-password'].includes(url.pathname);
  if (!isAllowedRoute || url.username !== '' || url.password !== '') {
    throw new AuthCallbackError('INVALID_CALLBACK', 'The authentication link is not allowed.');
  }

  const parameters = new URLSearchParams(url.search);
  const fragmentParameters = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const [key, value] of fragmentParameters) {
    if (!parameters.has(key)) {
      parameters.set(key, value);
    }
  }

  if (
    nonblank(parameters.get('error')) !== null ||
    nonblank(parameters.get('error_code')) !== null
  ) {
    throw new AuthCallbackError(
      'PROVIDER_ERROR',
      'The authentication link is expired, invalid, or already used.',
    );
  }

  const type = nonblank(parameters.get('type'));
  const kind: AuthCallbackKind =
    url.pathname === '/reset-password' || type === 'recovery' ? 'recovery' : 'confirmation';
  const code = nonblank(parameters.get('code'));
  if (code !== null) {
    return { action: 'exchange-code', code, kind };
  }

  const accessToken = nonblank(parameters.get('access_token'));
  const refreshToken = nonblank(parameters.get('refresh_token'));
  if (accessToken !== null && refreshToken !== null) {
    return { accessToken, action: 'set-session', kind, refreshToken };
  }

  const tokenHash = nonblank(parameters.get('token_hash'));
  if (tokenHash !== null && type !== null && allowedOtpTypes.has(type as never)) {
    return {
      action: 'verify-otp',
      kind,
      tokenHash,
      type: type as 'email' | 'magiclink' | 'recovery' | 'signup',
    };
  }

  throw new AuthCallbackError(
    'INVALID_CALLBACK',
    'The authentication link is missing required credentials.',
  );
}
