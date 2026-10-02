import { decideReservation } from './reservation.rules';

describe('decideReservation', () => {
  it('fails a product id that ends in -oos without needing a stock row', () => {
    const decision = decideReservation({
      items: [{ productId: 'sku-oos', quantity: 1 }],
      availableByProductId: new Map([['sku-oos', 10]]),
    });
    expect(decision).toEqual({
      outcome: 'failed',
      reason: 'sku-oos is out of stock',
    });
  });

  it('fails when the requested quantity is above available', () => {
    const decision = decideReservation({
      items: [{ productId: 'sku-1', quantity: 3 }],
      availableByProductId: new Map([['sku-1', 2]]),
    });
    expect(decision.outcome).toBe('failed');
  });

  it('reserves when every product can cover the summed quantity', () => {
    const decision = decideReservation({
      items: [
        { productId: 'sku-1', quantity: 2 },
        { productId: 'sku-1', quantity: 1 },
      ],
      availableByProductId: new Map([['sku-1', 3]]),
    });
    expect(decision).toEqual({ outcome: 'reserved' });
  });
});
