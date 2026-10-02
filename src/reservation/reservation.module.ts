import { Module } from '@nestjs/common';
import { InventoryConsumer } from '../messaging/inventory.consumer';
import { InventoryEventPublisher } from '../messaging/inventory-event.publisher';
import { ProductsModule } from '../products/products.module';
import { CosmosStockStore } from '../products/cosmos-stock.store';
import { CosmosReservationStore } from './cosmos-reservation.store';
import {
  RESERVATION_STORE,
  RESULT_PUBLISHER,
  STOCK_STORE,
  ReservationService,
} from './reservation.service';

@Module({
  imports: [ProductsModule],
  providers: [
    CosmosReservationStore,
    InventoryEventPublisher,
    { provide: STOCK_STORE, useExisting: CosmosStockStore },
    { provide: RESERVATION_STORE, useExisting: CosmosReservationStore },
    { provide: RESULT_PUBLISHER, useExisting: InventoryEventPublisher },
    ReservationService,
    InventoryConsumer,
  ],
})
export class ReservationModule {}
