import { Module } from '@nestjs/common';
import { CosmosStockStore } from './cosmos-stock.store';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [CosmosStockStore, ProductsService],
  exports: [CosmosStockStore],
})
export class ProductsModule {}
