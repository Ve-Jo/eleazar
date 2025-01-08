import { PrismaClient } from "@prisma/client";

let prisma = null;

export async function initializeDatabase() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ["error", "warn"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      connection: {
        pool: {
          min: 2,
          max: 10,
          idleTimeoutMillis: 30000,
          acquireTimeoutMillis: 30000,
        },
      },
      __internal: {
        useUds: true,
        query: {
          batchSize: 100,
          maxBatchSize: 200,
        },
      },
    });

    // Add query logging for performance monitoring with more details
    prisma.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const end = Date.now();
      const duration = end - start;

      if (duration > 500) {
        console.warn(
          `Slow query detected: ${params.model}.${params.action} took ${duration}ms`,
          {
            model: params.model,
            operation: params.action,
            args: params.args,
            duration: duration,
          }
        );
      }

      return result;
    });

    // Error handling middleware
    prisma.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (error) {
        if (error.code) {
          switch (error.code) {
            case "P2002":
              throw new Error(
                `Duplicate entry for ${error.meta?.target?.join(", ")}`
              );
            case "P2025":
              throw new Error("Record not found");
            case "P2003":
              throw new Error("Related record not found");
            default:
              throw error;
          }
        }
        throw error;
      }
    });

    try {
      await prisma.$connect();
      console.log("Database connection initialized successfully");
    } catch (error) {
      console.error("Failed to initialize database connection:", error);
      throw error;
    }
  }

  return prisma;
}

// Handle cleanup
process.on("beforeExit", async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught Exception:", error);
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(1);
});

process.on("unhandledRejection", async (error) => {
  console.error("Unhandled Rejection:", error);
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(1);
});
