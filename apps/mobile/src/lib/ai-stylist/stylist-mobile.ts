import type { AiStylistQuickRefinement } from '@thriftage/shared';

export const stylistStarterPrompts = [
  'Build me a university outfit under PKR 8,000.',
  'I need a polished wedding look.',
  'Give me a minimalist smart casual outfit.',
  'Build an easy gym outfit with sneakers.',
] as const;

const refinementMessages: Readonly<Record<AiStylistQuickRefinement, string>> = {
  ANOTHER_OPTION: 'Give me another option.',
  CHEAPER: 'Make this cheaper.',
  DIFFERENT_COLORS: 'Show me different colors.',
  DIFFERENT_SHOES: 'Keep the look but change the shoes.',
  MORE_CASUAL: 'Make this more casual.',
  MORE_FORMAL: 'Make this more formal.',
  MORE_MODEST: 'Show me something more modest.',
};

const refinementLabels: Readonly<Record<AiStylistQuickRefinement, string>> = {
  ANOTHER_OPTION: 'Another option',
  CHEAPER: 'Make it cheaper',
  DIFFERENT_COLORS: 'Different colors',
  DIFFERENT_SHOES: 'Change shoes',
  MORE_CASUAL: 'More casual',
  MORE_FORMAL: 'More formal',
  MORE_MODEST: 'More modest',
};

export function refinementMessage(refinement: AiStylistQuickRefinement): string {
  return refinementMessages[refinement];
}

export function refinementLabel(refinement: AiStylistQuickRefinement): string {
  return refinementLabels[refinement];
}

export function stylistErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'AI_STYLIST_DISABLED':
      return 'The Stylist is paused right now. Your saved outfits and marketplace are still available.';
    case 'AI_RATE_LIMITED':
      return 'You have reached the Stylist limit for now. Reopen a saved outfit or try again later.';
    case 'AI_GENERATION_IN_PROGRESS':
      return 'Your previous look is still being prepared. Give it a moment before trying again.';
    case 'AI_INVENTORY_UNAVAILABLE':
      return 'No eligible inventory matched those constraints. Try a wider budget, size, or style.';
    case 'AI_REQUEST_NOT_SUPPORTED':
      return 'The Stylist can help with outfits and Thriftage fashion discovery. Try a fashion request.';
    case 'AI_PROVIDER_TIMEOUT':
    case 'AI_PROVIDER_UNAVAILABLE':
      return 'The AI provider is unavailable. Thriftage will use its grounded fallback when possible.';
    default:
      return 'The Stylist could not finish that request. Nothing was purchased or changed.';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
