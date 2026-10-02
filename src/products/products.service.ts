import { Injectable, NotFoundException } from '@nestjs/common';
import { CosmosStockStore } from './cosmos-stock.store';

@Injectable()
export class ProductsService {
  constructor(private readonly stock: CosmosStockStore) {}

  upsert(productId: string, available: number) {
    return this.stock.upsert(productId.trim(), available);
  }

  async get(productId: string) {
    const stock = await this.stock.read(productId.trim());
    if (!stock) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }
    return stock;
  }
}
