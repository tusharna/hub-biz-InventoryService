export class StockConflictError extends Error {
  constructor() {
    super('stock write conflict');
    this.name = 'StockConflictError';
  }
}

export interface StockRecord {
  productId: string;
  available: number;
  etag: string;
}

export interface StockStore {
  read(productId: string): Promise<StockRecord | null>;
  replace(record: StockRecord, etag: string): Promise<StockRecord>;
  upsert(productId: string, available: number): Promise<StockRecord>;
}

export interface ReservationRecord {
  orderId: string;
  outcome: 'reserved' | 'failed';
  reason?: string;
}

export interface ReservationStore {
  find(orderId: string): Promise<ReservationRecord | null>;
  save(record: ReservationRecord): Promise<void>;
}

export interface InventoryResult {
  eventType: 'InventoryReserved' | 'InventoryReservationFailed';
  correlationId: string;
  causationId: string;
  data: {
    orderId: string;
    reason?: string;
  };
}

export interface ResultPublisher {
  publish(result: InventoryResult): Promise<void>;
}

export interface OrderLine {
  productId: string;
  quantity: number;
}

export interface OrderCreatedMessage {
  eventId: string;
  correlationId: string;
  data: {
    orderId: string;
    items: OrderLine[];
  };
}
