import { Controller, Get } from '@nestjs/common';
import { CosmosService } from '../cosmos/cosmos.service';

@Controller('health')
export class HealthController {
  constructor(private readonly cosmosService: CosmosService) {}

  @Get()
  async getHealth() {
    const cosmos = await this.cosmosService.checkHealth();
    return {
      status: cosmos.status === 'up' ? 'ok' : 'degraded',
      checks: { cosmos },
    };
  }
}
