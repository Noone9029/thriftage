import { describe, expect, it } from 'vitest';

import { createPhoneSignInRequest } from './supabase-phone-sign-in';

describe('Supabase phone sign-in request', () => {
  it('cannot create a second auth identity during phone login', () => {
    expect(createPhoneSignInRequest('+923001234567')).toEqual({
      options: { shouldCreateUser: false },
      phone: '+923001234567',
    });
  });
});
