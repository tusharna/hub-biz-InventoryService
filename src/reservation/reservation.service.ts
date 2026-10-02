import { Inject, Injectable } from '@nestjs/common';
import { decideReservation, requestedQuantities } from './reservation.rules';
import {
  StockConflictError,
  type InventoryResult,
  type OrderCreatedMessage,
  type ReservationRecord,
  type ReservationStore,
  type ResultPublisher,
  type StockStore,
} from './reservation.types';

export const STOCK_STORE = Symbol('STOCK_STORE');
export const RESERVATION_STORE = Symbol('RESERVATION_STORE');
export const RESULT_PUBLISHER = Symbol('RESULT_PUBLISHER');

@Injectable()
export class ReservationService {
  constructor(
    @Inject(STOCK_STORE) private readonly stock: StockStore,
    @Inject(RESERVATION_STORE) private readonly reservations: ReservationStore,
    @Inject(RESULT_PUBLISHER) private readonly results: ResultPublisher,
  ) {}

  async handle(event: OrderCreatedMessage): Promise<void> {
    const orderId = event.data.orderId;
    const existing = await this.reservations.find(orderId);
    if (existing) {
      await this.results.publish(toResult(event, existing));
      return;
    }

    const requested = requestedQuantities(event.data.items);
    const available = new Map<string, number>();
    for (const productId of requested.keys()) {
      const stock = await this.stock.read(productId);
      if (stock) {
        available.set(productId, stock.available);
      }
    }

    const decision = decideReservation({
      items: event.data.items,
      availableByProductId: available,
    });
    if (decision.outcome === 'failed') {
      const record: ReservationRecord = {
        orderId,
        outcome: 'failed',
        reason: decision.reason,
      };
      await this.reservations.save(record);
      await this.results.publish(toResult(event, record));
      return;
    }

    const taken: { productId: string; quantity: number }[] = [];
    try {
      for (const [productId, quantity] of requested) {
        await this.decrement(productId, quantity);
        taken.push({ productId, quantity });
      }
    } catch {
      await this.compensate(taken);
      const record: ReservationRecord = {
        orderId,
        outcome: 'failed',
        reason: 'stock changed during reservation',
      };
      await this.reservations.save(record);
      await this.results.publish(toResult(event, record));
      return;
    }

    const reserved: ReservationRecord = { orderId, outcome: 'reserved' };
    await this.reservations.save(reserved);
    await this.results.publish(toResult(event, reserved));
  }

  private async decrement(productId: string, quantity: number): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await this.stock.read(productId);
      if (!current || current.available < quantity) {
        throw new StockConflictError();
      }
      try {
        await this.stock.replace(
          { ...current, available: current.available - quantity },
          current.etag,
        );
        return;
      } catch (error: unknown) {
        if (!(error instanceof StockConflictError) || attempt === 1) {
          throw error;
        }
      }
    }
  }

  private async compensate(
    taken: { productId: string; quantity: number }[],
  ): Promise<void> {
    for (const item of [...taken].reverse()) {
      const current = await this.stock.read(item.productId);
      if (!current) {
        continue;
      }
      await this.stock.replace(
        { ...current, available: current.available + item.quantity },
        current.etag,
      );
    }
  }
}

function toResult(
  event: OrderCreatedMessage,
  record: ReservationRecord,
): InventoryResult {
  return {
    eventType:
      record.outcome === 'reserved'
        ? 'InventoryReserved'
        : 'InventoryReservationFailed',
    correlationId: event.correlationId,
    causationId: event.eventId,
    data: {
      orderId: record.orderId,
      ...(record.reason ? { reason: record.reason } : {}),
    },
  };
}
