export interface InventoryConfiguration {
  nodeEnv: string;
  port: number;
  cosmos: {
    endpoint: string;
    key: string;
    database: string;
    stockContainer: string;
  };
  serviceBus: {
    connectionString: string;
    ordersTopic: string;
    inventorySubscription: string;
  };
}

export default (): InventoryConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  cosmos: {
    endpoint: process.env.COSMOS_ENDPOINT ?? '',
    key: process.env.COSMOS_KEY ?? '',
    database: process.env.COSMOS_DATABASE ?? '',
    stockContainer: process.env.COSMOS_STOCK_CONTAINER ?? 'stock',
  },
  serviceBus: {
    connectionString: process.env.SERVICE_BUS_CONNECTION_STRING ?? '',
    ordersTopic: process.env.SERVICE_BUS_ORDERS_TOPIC ?? '',
    inventorySubscription:
      process.env.SERVICE_BUS_INVENTORY_SUBSCRIPTION ??
      'inventory-subscription',
  },
});
