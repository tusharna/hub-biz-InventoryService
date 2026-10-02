const NODE_ENV_VALUES = ['development', 'production', 'test'] as const;

function required(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing or empty required environment variable: ${key}.`);
  }
  return value.trim();
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = config.NODE_ENV ?? 'development';
  if (
    typeof nodeEnv !== 'string' ||
    !NODE_ENV_VALUES.includes(nodeEnv as never)
  ) {
    throw new Error(
      `Invalid NODE_ENV. Expected one of: ${NODE_ENV_VALUES.join(', ')}`,
    );
  }
  const endpoint = required(config, 'COSMOS_ENDPOINT');
  if (!endpoint.startsWith('https://') && !endpoint.startsWith('http://')) {
    throw new Error('Invalid COSMOS_ENDPOINT. Expected an http(s) URL.');
  }
  const connectionString = required(config, 'SERVICE_BUS_CONNECTION_STRING');
  if (!/Endpoint=sb:\/\//i.test(connectionString)) {
    throw new Error(
      'Invalid SERVICE_BUS_CONNECTION_STRING. Expected Endpoint=sb://…',
    );
  }
  required(config, 'COSMOS_KEY');
  required(config, 'COSMOS_DATABASE');
  required(config, 'SERVICE_BUS_ORDERS_TOPIC');
  return config;
}
