type ConnectableClient = {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
};

type LifecycleConfig = {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  delay: (ms: number) => Promise<void>;
};

async function initializeDatabaseConnection<T extends ConnectableClient>(
  client: T,
  config: LifecycleConfig
): Promise<void> {
  let retries = 0;
  let connected = false;

  while (retries < config.maxRetries && !connected) {
    try {
      await client.$connect();
      console.log("Database connection initialized successfully");
      connected = true;
    } catch (error) {
      retries++;
      if (retries >= config.maxRetries) {
        console.error(
          `Prisma connect failed after ${config.maxRetries} retries:`,
          error
        );
        throw error;
      }
      const delayMs = Math.min(
        config.initialDelayMs * Math.pow(2, retries - 1),
        config.maxDelayMs
      );
      console.warn(
        `Prisma connect failed (attempt ${retries}/${config.maxRetries}). Retrying in ${delayMs}ms...`
      );
      await config.delay(delayMs);
    }
  }

  if (!connected) {
    throw new Error("Failed to connect to Prisma after multiple retries.");
  }
}

async function disconnectDatabaseConnection<T extends ConnectableClient>(
  client: T
): Promise<void> {
  await client.$disconnect();
  console.log("Database connection closed successfully");
}

export { initializeDatabaseConnection, disconnectDatabaseConnection };
