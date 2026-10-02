import type { OrderLine } from './reservation.types';

export type ReservationDecision =
  | { outcome: 'reserved' }
  | { outcome: 'failed'; reason: string };

export function requestedQuantities(
  items: OrderLine[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  }
  return totals;
}

export function decideReservation(input: {
  items: OrderLine[];
  availableByProductId: ReadonlyMap<string, number>;
}): ReservationDecision {
  for (const [productId, quantity] of requestedQuantities(input.items)) {
    if (productId.endsWith('-oos')) {
      return { outcome: 'failed', reason: `${productId} is out of stock` };
    }
    const available = input.availableByProductId.get(productId);
    if (available === undefined) {
      return { outcome: 'failed', reason: `${productId} was not found` };
    }
    if (quantity > available) {
      return {
        outcome: 'failed',
        reason: `${productId} has ${available} available`,
      };
    }
  }
  return { outcome: 'reserved' };
}
