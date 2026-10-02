import { Injectable } from '@nestjs/common';
import { CosmosService } from '../cosmos/cosmos.service';
import type {
  ReservationRecord,
  ReservationStore,
} from '../reservation/reservation.types';

interface ReservationDocument {
  id: string;
  productId: string;
  type: 'reservation';
  orderId: string;
  outcome: 'reserved' | 'failed';
  reason?: string;
}

@Injectable()
export class CosmosReservationStore implements ReservationStore {
  constructor(private readonly cosmosService: CosmosService) {}

  async find(orderId: string): Promise<ReservationRecord | null> {
    const partitionKey = reservationPartition(orderId);
    const response = await this.cosmosService
      .getStockContainer()
      .item(orderId, partitionKey)
      .read<ReservationDocument>();
    if (!response.resource || response.resource.type !== 'reservation') {
      return null;
    }
    return toRecord(response.resource);
  }

  async save(record: ReservationRecord): Promise<void> {
    const document: ReservationDocument = {
      id: record.orderId,
      productId: reservationPartition(record.orderId),
      type: 'reservation',
      orderId: record.orderId,
      outcome: record.outcome,
      ...(record.reason ? { reason: record.reason } : {}),
    };
    await this.cosmosService.getStockContainer().items.create(document);
  }
}

function reservationPartition(orderId: string): string {
  return `reservation:${orderId}`;
}

function toRecord(document: ReservationDocument): ReservationRecord {
  return {
    orderId: document.orderId,
    outcome: document.outcome,
    ...(document.reason ? { reason: document.reason } : {}),
  };
}
