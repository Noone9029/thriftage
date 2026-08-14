import { describe, expect, it } from 'vitest';

import {
  isAbortError,
  refinementMessage,
  stylistErrorMessage,
  stylistStarterPrompts,
} from './stylist-mobile';

describe('stylist mobile behavior', () => {
  it('turns quick refinements into bounded user-visible requests', () => {
    expect(refinementMessage('CHEAPER')).toBe('Make this cheaper.');
    expect(refinementMessage('MORE_MODEST')).toBe('Show me something more modest.');
  });

  it('offers useful grounded starter intents', () => {
    expect(stylistStarterPrompts).toHaveLength(4);
    expect(stylistStarterPrompts[0]).toContain('PKR 8,000');
  });

  it('maps stable backend limits to actionable copy', () => {
    expect(stylistErrorMessage('AI_RATE_LIMITED')).toContain('limit');
    expect(stylistErrorMessage('AI_STYLIST_DISABLED')).toContain('saved outfits');
  });

  it('distinguishes local cancellation from request failure', () => {
    expect(isAbortError(new DOMException('cancelled', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('network'))).toBe(false);
  });
});
