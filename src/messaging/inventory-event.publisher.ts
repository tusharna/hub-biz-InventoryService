import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceBusClient, type ServiceBusSender } from '@azure/service-bus';
import type { InventoryConfiguration } from '../config/configuration';
import type {
  InventoryResult,
  ResultPublisher,
} from '../reservation/reservation.types';

@Injectable()
export class InventoryEventPublisher
  implements ResultPublisher, OnModuleDestroy
{
  private client: ServiceBusClient | undefined;
  private sender: ServiceBusSender | undefined;

  constructor(
    private readonly configService: ConfigService<InventoryConfiguration, true>,
  ) {}

  async publish(result: InventoryResult): Promise<void> {
    const sender = this.getSender();
    const body = {
      eventId: randomUUID(),
      eventType: result.eventType,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: result.correlationId,
      causationId: result.causationId,
      data: result.data,
    };
    await sender.sendMessages({
      body,
      messageId: body.eventId,
      correlationId: result.correlationId,
      contentType: 'application/json',
      applicationProperties: { eventType: result.eventType },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.sender?.close();
    await this.client?.close();
    this.sender = undefined;
    this.client = undefined;
  }

  private getSender(): ServiceBusSender {
    if (!this.sender) {
      const serviceBus = this.configService.get('serviceBus', { infer: true });
      this.client = new ServiceBusClient(serviceBus.connectionString);
      this.sender = this.client.createSender(serviceBus.ordersTopic);
    }
    return this.sender;
  }
}
