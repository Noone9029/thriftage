import { Injectable } from '@nestjs/common';
import { getPrismaClient, type Address, type PrismaClient } from '@thriftage/db';
import type { AddressInput, AddressUpdateInput } from '@thriftage/shared';

import { CommerceDomainError } from './commerce.errors';

@Injectable()
export class AddressRepository {
  public constructor(private readonly prisma?: PrismaClient) {}
  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public list(userId: string): Promise<readonly Address[]> {
    return this.client.address.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      where: { userId },
    });
  }

  public async create(userId: string, input: AddressInput) {
    return this.client.$transaction(async (transaction) => {
      const count = await transaction.address.count({ where: { userId } });
      const isDefault = input.isDefault || count === 0;
      if (isDefault)
        await transaction.address.updateMany({ data: { isDefault: false }, where: { userId } });
      return transaction.address.create({
        data: {
          ...input,
          addressLine2: input.addressLine2 ?? null,
          deliveryInstructions: input.deliveryInstructions ?? null,
          isDefault,
          postalCode: input.postalCode ?? null,
          userId,
        },
      });
    });
  }

  public async update(userId: string, addressId: string, input: AddressUpdateInput) {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.address.findFirst({ where: { id: addressId, userId } });
      if (existing === null) throw new CommerceDomainError('ADDRESS_NOT_FOUND');
      if (input.isDefault === true)
        await transaction.address.updateMany({ data: { isDefault: false }, where: { userId } });
      return transaction.address.update({
        data: {
          ...(input.addressLine1 === undefined ? {} : { addressLine1: input.addressLine1 }),
          ...(input.addressLine2 === undefined ? {} : { addressLine2: input.addressLine2 }),
          ...(input.city === undefined ? {} : { city: input.city }),
          ...(input.countryCode === undefined ? {} : { countryCode: input.countryCode }),
          ...(input.deliveryInstructions === undefined
            ? {}
            : { deliveryInstructions: input.deliveryInstructions }),
          ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
          ...(input.label === undefined ? {} : { label: input.label }),
          ...(input.phone === undefined ? {} : { phone: input.phone }),
          ...(input.postalCode === undefined ? {} : { postalCode: input.postalCode }),
          ...(input.recipientName === undefined ? {} : { recipientName: input.recipientName }),
          ...(input.region === undefined ? {} : { region: input.region }),
        },
        where: { id: addressId },
      });
    });
  }

  public async remove(userId: string, addressId: string): Promise<void> {
    const result = await this.client.address.deleteMany({ where: { id: addressId, userId } });
    if (result.count === 0) throw new CommerceDomainError('ADDRESS_NOT_FOUND');
  }

  public async findOwned(userId: string, addressId: string) {
    const address = await this.client.address.findFirst({ where: { id: addressId, userId } });
    if (address === null) throw new CommerceDomainError('ADDRESS_NOT_FOUND');
    return address;
  }
}
