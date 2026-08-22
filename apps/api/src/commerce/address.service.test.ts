import { describe, expect, it, vi } from 'vitest';

import { AddressService } from './address.service';

const userId = '00000000-0000-4000-8000-000000000001';
const addressId = '00000000-0000-4000-8000-000000000002';
const createdAt = new Date('2026-08-22T19:51:55.000Z');
const updatedAt = new Date('2026-08-22T19:51:55.000Z');

const record = {
  addressLine1: '1 Beta Street',
  addressLine2: null,
  city: 'Lahore',
  countryCode: 'PK',
  createdAt,
  deliveryInstructions: null,
  id: addressId,
  isDefault: true,
  label: 'Home',
  phone: '+923001234567',
  postalCode: null,
  recipientName: 'Beta Buyer',
  region: 'Punjab',
  updatedAt,
  userId,
};

describe('AddressService response serialization', () => {
  it('does not expose the repository user id when creating an address', async () => {
    const repository = { create: vi.fn().mockResolvedValue(record) };
    const service = new AddressService(repository as never);

    const result = await service.create(userId, {
      addressLine1: '1 Beta Street',
      addressLine2: null,
      city: 'Lahore',
      countryCode: 'PK',
      deliveryInstructions: null,
      isDefault: true,
      label: 'Home',
      phone: '+923001234567',
      postalCode: null,
      recipientName: 'Beta Buyer',
      region: 'Punjab',
    });

    expect(result).toEqual({
      addressLine1: '1 Beta Street',
      addressLine2: null,
      city: 'Lahore',
      countryCode: 'PK',
      createdAt: createdAt.toISOString(),
      deliveryInstructions: null,
      id: addressId,
      isDefault: true,
      label: 'Home',
      phone: '+923001234567',
      postalCode: null,
      recipientName: 'Beta Buyer',
      region: 'Punjab',
      updatedAt: updatedAt.toISOString(),
    });
    expect(result).not.toHaveProperty('userId');
  });
});
