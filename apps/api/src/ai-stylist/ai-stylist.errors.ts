import { HttpException, HttpStatus } from '@nestjs/common';
import type { AiStylistErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';

const definitions: Record<
  AiStylistErrorCode,
  { readonly message: string; readonly status: HttpStatus }
> = {
  AI_CONVERSATION_FORBIDDEN: {
    message: 'You cannot access this stylist conversation.',
    status: HttpStatus.FORBIDDEN,
  },
  AI_CONVERSATION_NOT_FOUND: {
    message: 'Stylist conversation not found.',
    status: HttpStatus.NOT_FOUND,
  },
  AI_GENERATION_IN_PROGRESS: {
    message: 'A stylist response is already being prepared.',
    status: HttpStatus.CONFLICT,
  },
  AI_INVENTORY_UNAVAILABLE: {
    message: 'No eligible marketplace outfit is available for those constraints.',
    status: HttpStatus.CONFLICT,
  },
  AI_OUTFIT_NOT_FOUND: { message: 'Outfit not found.', status: HttpStatus.NOT_FOUND },
  AI_PROVIDER_TIMEOUT: {
    message: 'The stylist took too long to respond. Try again.',
    status: HttpStatus.GATEWAY_TIMEOUT,
  },
  AI_PROVIDER_UNAVAILABLE: {
    message: 'The AI stylist is unavailable right now.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  AI_RATE_LIMITED: {
    message: 'You have reached the current stylist usage limit. Try again later.',
    status: HttpStatus.TOO_MANY_REQUESTS,
  },
  AI_REQUEST_NOT_SUPPORTED: {
    message: 'The stylist can help with fashion, outfits, and marketplace discovery.',
    status: HttpStatus.BAD_REQUEST,
  },
  AI_RESPONSE_INVALID: {
    message: 'The stylist could not produce a verified recommendation.',
    status: HttpStatus.BAD_GATEWAY,
  },
  AI_STYLIST_DISABLED: {
    message: 'The AI stylist is currently unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  AI_TOOL_LIMIT_EXCEEDED: {
    message: 'The stylist could not complete the inventory search safely.',
    status: HttpStatus.BAD_GATEWAY,
  },
};

export class AiStylistDomainError extends Error {
  public constructor(
    public readonly code: AiStylistErrorCode,
    public readonly operations?: {
      readonly latencyMs: number;
      readonly toolCallCount: number;
      readonly usage: {
        readonly cachedInputTokens: number;
        readonly inputTokens: number;
        readonly outputTokens: number;
      };
    },
  ) {
    super(code);
    this.name = 'AiStylistDomainError';
  }
}

export class AiStylistApiException extends HttpException {
  public constructor(public readonly code: AiStylistErrorCode) {
    const definition = definitions[code];
    super({ code, message: definition.message, statusCode: definition.status }, definition.status);
  }
}

export function mapAiStylistError(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  if (error instanceof AiStylistDomainError) return new AiStylistApiException(error.code);
  if (error instanceof ZodError) return new AiStylistApiException('AI_RESPONSE_INVALID');
  return new AiStylistApiException('AI_PROVIDER_UNAVAILABLE');
}
