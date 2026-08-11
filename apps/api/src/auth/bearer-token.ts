import { AuthApiException } from './auth.errors';

export function extractBearerToken(
  authorizationHeader: string | readonly string[] | undefined,
): string {
  if (typeof authorizationHeader !== 'string') {
    throw new AuthApiException('AUTH_REQUIRED');
  }

  const match = /^Bearer[ \t]+([^\s]+)$/i.exec(authorizationHeader.trim());
  if (match === null || match[1] === undefined || match[1].trim() === '') {
    throw new AuthApiException('AUTH_REQUIRED');
  }

  return match[1];
}
