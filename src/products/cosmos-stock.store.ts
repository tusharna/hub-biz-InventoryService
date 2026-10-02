import { Injectable } from '@nestjs/common';
import { CosmosService } from '../cosmos/cosmos.service';
import {
  StockConflictError,
  type StockRecord,
  type StockStore,
} from '../reservation/reservation.types';

interface StockDocument {
  id: string;
  productId: string;
  type: 'stock';
  available: number;
}

@Injectable()
export class CosmosStockStore implements StockStore {
  constructor(private readonly cosmosService: CosmosService) {}

  async read(productId: string): Promise<StockRecord | null> {
    const response = await this.cosmosService
      .getStockContainer()
      .item(productId, productId)
      .read<StockDocument>();
    if (!response.resource || response.resource.type !== 'stock') {
      return null;
    }
    return {
      productId: response.resource.productId,
      available: response.resource.available,
      etag: response.etag ?? '',
    };
  }

  async replace(record: StockRecord, etag: string): Promise<StockRecord> {
    const document: StockDocument = {
      id: record.productId,
      productId: record.productId,
      type: 'stock',
      available: record.available,
    };
    try {
      const response = await this.cosmosService
        .getStockContainer()
        .item(record.productId, record.productId)
        .replace<StockDocument>(document, {
          accessCondition: { type: 'IfMatch', condition: etag },
        });
      return {
        productId: record.productId,
        available: record.available,
        etag: response.etag ?? '',
      };
    } catch (error: unknown) {
      if (isPreconditionFailed(error)) {
        throw new StockConflictError();
      }
      throw error;
    }
  }

  async upsert(productId: string, available: number): Promise<StockRecord> {
    const response = await this.cosmosService
      .getStockContainer()
      .items.upsert<StockDocument>({
        id: productId,
        productId,
        type: 'stock',
        available,
      });
    return {
      productId,
      available,
      etag: response.etag ?? '',
    };
  }
}

function isPreconditionFailed(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code?: number | string }).code;
  return code === 412 || code === '412';
}
