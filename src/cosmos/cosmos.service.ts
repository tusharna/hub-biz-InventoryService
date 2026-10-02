import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CosmosClient, type Container } from '@azure/cosmos';
import type { InventoryConfiguration } from '../config/configuration';

@Injectable()
export class CosmosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CosmosService.name);
  private client: CosmosClient | undefined;
  private container: Container | undefined;

  constructor(
    private readonly configService: ConfigService<InventoryConfiguration, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const cosmos = this.configService.get('cosmos', { infer: true });
    this.client = new CosmosClient({
      endpoint: cosmos.endpoint,
      key: cosmos.key,
    });
    const { database } = await this.client.databases.createIfNotExists({
      id: cosmos.database,
    });
    const created = await database.containers.createIfNotExists({
      id: cosmos.stockContainer,
      partitionKey: { paths: ['/productId'] },
    });
    this.container = created.container;
    this.logger.log(
      `Stock container ready: ${cosmos.database}/${cosmos.stockContainer}`,
    );
  }

  onModuleDestroy(): void {
    this.client = undefined;
    this.container = undefined;
  }

  getStockContainer(): Container {
    if (!this.container) {
      throw new Error('Cosmos stock container is not ready.');
    }
    return this.container;
  }

  async checkHealth(): Promise<{ status: 'up' | 'down'; message?: string }> {
    try {
      await this.getStockContainer().read();
      return { status: 'up' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Cosmos down';
      return { status: 'down', message };
    }
  }
}
