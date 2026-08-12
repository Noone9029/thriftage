import { Inject, Injectable } from '@nestjs/common';
import {
  addressInputSchema,
  addressSchema,
  addressUpdateInputSchema,
  type Address,
  type AddressInput,
  type AddressUpdateInput,
} from '@thriftage/shared';

import { normalizePhoneNumber } from '../phone-verification/phone-number';
import { AddressRepository } from './address.repository';
import { mapCommerceError } from './commerce.errors';

@Injectable()
export class AddressService {
  public constructor(@Inject(AddressRepository) private readonly repository: AddressRepository) {}

  private present(record: Awaited<ReturnType<AddressRepository['create']>>): Address {
    return addressSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  }

  public async list(userId: string): Promise<readonly Address[]> {
    try {
      return (await this.repository.list(userId)).map((record) => this.present(record));
    } catch (error: unknown) {
      throw mapCommerceError(error);
    }
  }

  public async create(userId: string, input: AddressInput): Promise<Address> {
    try {
      const parsed = addressInputSchema.parse(input);
      return this.present(
        await this.repository.create(userId, {
          ...parsed,
          phone: normalizePhoneNumber(parsed.phone),
        }),
      );
    } catch (error: unknown) {
      throw mapCommerceError(error);
    }
  }

  public async update(
    userId: string,
    addressId: string,
    input: AddressUpdateInput,
  ): Promise<Address> {
    try {
      const parsed = addressUpdateInputSchema.parse(input);
      return this.present(
        await this.repository.update(userId, addressId, {
          ...parsed,
          ...(parsed.phone === undefined ? {} : { phone: normalizePhoneNumber(parsed.phone) }),
        }),
      );
    } catch (error: unknown) {
      throw mapCommerceError(error);
    }
  }

  public async remove(userId: string, addressId: string): Promise<void> {
    try {
      await this.repository.remove(userId, addressId);
    } catch (error: unknown) {
      throw mapCommerceError(error);
    }
  }
}
