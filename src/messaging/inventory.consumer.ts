import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServiceBusReceiver } from '@azure/service-bus';
import { ServiceBusClient } from '@azure/service-bus';
import type { InventoryConfiguration } from '../config/configuration';
import { ReservationService } from '../reservation/reservation.service';
import type { OrderCreatedMessage } from '../reservation/reservation.types';

@Injectable()
export class InventoryConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryConsumer.name);
  private client: ServiceBusClient | undefined;
  private receiver: ServiceBusReceiver | undefined;
  private subscription: ReturnType<ServiceBusReceiver['subscribe']> | undefined;

  constructor(
    private readonly configService: ConfigService<InventoryConfiguration, true>,
    private readonly reservationService: ReservationService,
  ) {}

  onModuleInit(): void {
    const serviceBus = this.configService.get('serviceBus', { infer: true });
    this.client = new ServiceBusClient(serviceBus.connectionString);
    this.receiver = this.client.createReceiver(
      serviceBus.ordersTopic,
      serviceBus.inventorySubscription,
    );
    const receiver = this.receiver;
    this.subscription = receiver.subscribe(
      {
        processMessage: async (message) => {
          const event = readOrderCreated(message.body);
          if (!event) {
            this.logger.warn('Completing message that is not OrderCreated.');
            await receiver.completeMessage(message);
            return;
          }
          try {
            await this.reservationService.handle(event);
            await receiver.completeMessage(message);
          } catch (error: unknown) {
            const detail = error instanceof Error ? error.message : 'unknown';
            this.logger.warn(`Abandoning inventory message: ${detail}`);
            await receiver.abandonMessage(message);
          }
        },
        processError: (args) => {
          this.logger.error(args.error.message);
          return Promise.resolve();
        },
      },
      { autoCompleteMessages: false },
    );
    this.logger.log(
      `Listening on ${serviceBus.ordersTopic}/${serviceBus.inventorySubscription}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscription?.close();
    await this.receiver?.close();
    await this.client?.close();
  }
}

export function readOrderCreated(value: unknown): OrderCreatedMessage | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.eventType !== 'OrderCreated') {
    return null;
  }
  if (
    typeof record.eventId !== 'string' ||
    typeof record.correlationId !== 'string'
  ) {
    return null;
  }
  const data = record.data;
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const body = data as Record<string, unknown>;
  if (typeof body.orderId !== 'string' || !Array.isArray(body.items)) {
    return null;
  }
  const items = body.items.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }
    const line = item as Record<string, unknown>;
    if (
      typeof line.productId !== 'string' ||
      typeof line.quantity !== 'number'
    ) {
      return [];
    }
    return [{ productId: line.productId, quantity: line.quantity }];
  });
  if (items.length !== body.items.length || items.length === 0) {
    return null;
  }
  return {
    eventId: record.eventId,
    correlationId: record.correlationId,
    data: { orderId: body.orderId, items },
  };
}
