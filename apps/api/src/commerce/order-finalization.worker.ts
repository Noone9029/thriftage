import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { OrderRepository } from './order.repository';
import { PayFastPaymentService } from './payfast-payment.service';

@Injectable()
export class OrderFinalizationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderFinalizationWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  public constructor(
    @Inject(OrderRepository) private readonly orders: OrderRepository,
    @Inject(PayFastPaymentService) private readonly payfast?: PayFastPaymentService,
  ) {}
  public onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 2_000);
    this.timer.unref();
  }
  public onModuleDestroy(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }
  public async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.orders.finalizeDelivered();
      await this.payfast?.expireDue();
    } catch {
      this.logger.error('Order finalization polling failed: code=ORDER_FINALIZATION_POLL_FAILED');
    } finally {
      this.running = false;
    }
  }
}
