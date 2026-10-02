import { ReservationService } from './reservation.service';
import { StockConflictError } from './reservation.types';
import type {
  InventoryResult,
  OrderCreatedMessage,
  ReservationRecord,
  ReservationStore,
  ResultPublisher,
  StockRecord,
  StockStore,
} from './reservation.types';

class MemoryStock implements StockStore {
  readonly replaceCalls: StockRecord[] = [];
  failProduct: string | null = null;

  constructor(private readonly records: Map<string, StockRecord>) {}

  read(productId: string): Promise<StockRecord | null> {
    const record = this.records.get(productId);
    return Promise.resolve(record ? { ...record } : null);
  }

  replace(record: StockRecord, etag: string): Promise<StockRecord> {
    const current = this.records.get(record.productId);
    if (!current || current.etag !== etag || this.failProduct === record.productId) {
      return Promise.reject(new StockConflictError());
    }
    const next = { ...record, etag: `${etag}-next` };
    this.records.set(record.productId, next);
    this.replaceCalls.push(next);
    return Promise.resolve(next);
  }

  upsert(productId: string, available: number): Promise<StockRecord> {
    const next = { productId, available, etag: 'etag-upsert' };
    this.records.set(productId, next);
    return Promise.resolve(next);
  }
}

class MemoryReservations implements ReservationStore {
  constructor(private readonly saved = new Map<string, ReservationRecord>()) {}

  find(orderId: string): Promise<ReservationRecord | null> {
    return Promise.resolve(this.saved.get(orderId) ?? null);
  }

  save(record: ReservationRecord): Promise<void> {
    this.saved.set(record.orderId, record);
    return Promise.resolve();
  }
}

class MemoryPublisher implements ResultPublisher {
  readonly published: InventoryResult[] = [];

  publish(result: InventoryResult): Promise<void> {
    this.published.push(result);
    return Promise.resolve();
  }
}

function event(
  items: { productId: string; quantity: number }[],
): OrderCreatedMessage {
  return {
    eventId: 'evt-1',
    correlationId: 'order-1',
    data: { orderId: 'order-1', items },
  };
}

describe('ReservationService', () => {
  it('does not change stock when a product id ends in -oos', async () => {
    const stock = new MemoryStock(
      new Map([['sku-oos', { productId: 'sku-oos', available: 8, etag: 'e1' }]]),
    );
    const reservations = new MemoryReservations();
    const publisher = new MemoryPublisher();
    const service = new ReservationService(stock, reservations, publisher);

    await service.handle(event([{ productId: 'sku-oos', quantity: 1 }]));

    expect(stock.replaceCalls).toEqual([]);
    expect(publisher.published[0]?.eventType).toBe(
      'InventoryReservationFailed',
    );
    expect(publisher.published[0]?.causationId).toBe('evt-1');
    expect(
      (await stock.read('sku-oos'))?.available,
    ).toBe(8);
  });

  it('does not change stock when quantity is above available', async () => {
    const stock = new MemoryStock(
      new Map([['sku-1', { productId: 'sku-1', available: 1, etag: 'e1' }]]),
    );
    const publisher = new MemoryPublisher();
    const service = new ReservationService(
      stock,
      new MemoryReservations(),
      publisher,
    );

    await service.handle(event([{ productId: 'sku-1', quantity: 4 }]));

    expect(stock.replaceCalls).toEqual([]);
    expect(publisher.published[0]?.data.reason).toContain('has 1 available');
  });

  it('puts stock back when a later product conflicts', async () => {
    const stock = new MemoryStock(
      new Map([
        ['sku-a', { productId: 'sku-a', available: 5, etag: 'a' }],
        ['sku-b', { productId: 'sku-b', available: 5, etag: 'b' }],
      ]),
    );
    stock.failProduct = 'sku-b';
    const publisher = new MemoryPublisher();
    const service = new ReservationService(
      stock,
      new MemoryReservations(),
      publisher,
    );

    await service.handle(
      event([
        { productId: 'sku-a', quantity: 2 },
        { productId: 'sku-b', quantity: 1 },
      ]),
    );

    expect((await stock.read('sku-a'))?.available).toBe(5);
    expect((await stock.read('sku-b'))?.available).toBe(5);
    expect(publisher.published[0]?.eventType).toBe(
      'InventoryReservationFailed',
    );
    expect(publisher.published[0]?.data.reason).toBe(
      'stock changed during reservation',
    );
  });

  it('republishes a saved reservation and does not decrement again', async () => {
    const stock = new MemoryStock(
      new Map([['sku-1', { productId: 'sku-1', available: 5, etag: 'e1' }]]),
    );
    const reservations = new MemoryReservations(
      new Map([['order-1', { orderId: 'order-1', outcome: 'reserved' }]]),
    );
    const publisher = new MemoryPublisher();
    const service = new ReservationService(stock, reservations, publisher);

    await service.handle(event([{ productId: 'sku-1', quantity: 2 }]));
    await service.handle(event([{ productId: 'sku-1', quantity: 2 }]));

    expect(stock.replaceCalls).toEqual([]);
    expect(publisher.published).toHaveLength(2);
    expect(publisher.published.every((item) => item.eventType === 'InventoryReserved')).toBe(
      true,
    );
    expect((await stock.read('sku-1'))?.available).toBe(5);
  });
});
