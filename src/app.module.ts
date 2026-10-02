import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { CosmosModule } from './cosmos/cosmos.module';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { ReservationModule } from './reservation/reservation.module';

@Module({
  imports: [
    AppConfigModule,
    CosmosModule,
    HealthModule,
    ProductsModule,
    ReservationModule,
  ],
})
export class AppModule {}
