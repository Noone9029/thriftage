import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  addressInputSchema,
  addressUpdateInputSchema,
  type Address,
  type AddressInput,
  type AddressUpdateInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AddressService } from './address.service';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('addresses')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class AddressController {
  public constructor(@Inject(AddressService) private readonly addresses: AddressService) {}
  @Get()
  public list(@CurrentUser() user: User): Promise<readonly Address[]> {
    return this.addresses.list(user.id);
  }
  @Post()
  public create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(addressInputSchema)) input: AddressInput,
  ): Promise<Address> {
    return this.addresses.create(user.id, input);
  }
  @Patch(':addressId')
  public update(
    @CurrentUser() user: User,
    @Param('addressId', uuidPipe) addressId: string,
    @Body(new ZodValidationPipe(addressUpdateInputSchema)) input: AddressUpdateInput,
  ): Promise<Address> {
    return this.addresses.update(user.id, addressId, input);
  }
  @Delete(':addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  public remove(
    @CurrentUser() user: User,
    @Param('addressId', uuidPipe) addressId: string,
  ): Promise<void> {
    return this.addresses.remove(user.id, addressId);
  }
}
