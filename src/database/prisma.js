import prisma from "./client.js";

// Middleware for logging and performance monitoring
prisma.$use(async (params, next) => {
  const start = Date.now();
  try {
    const result = await next(params);
    const end = Date.now();
    console.log(`Query ${params.model}.${params.action} took ${end - start}ms`);
    return result;
  } catch (error) {
    const end = Date.now();
    console.error(
      `Query ${params.model}.${params.action} failed after ${end - start}ms`
    );
    console.error("Parameters:", params);
    console.error("Error:", error);
    throw error;
  }
});

// Error handling middleware
prisma.$use(async (params, next) => {
  try {
    return await next(params);
  } catch (error) {
    // Handle specific Prisma errors
    if (error.code) {
      switch (error.code) {
        case "P2002": // Unique constraint failed
          throw new Error(
            `Duplicate entry for ${error.meta?.target?.join(", ")}`
          );
        case "P2025": // Record not found
          throw new Error("Record not found");
        case "P2003": // Foreign key constraint failed
          throw new Error("Related record not found");
        default:
          throw error;
      }
    }
    throw error;
  }
});

// Handle cleanup on app termination
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

// Handle cleanup on unexpected errors
process.on("uncaughtException", async (error) => {
  console.error("Uncaught Exception:", error);
  await prisma.$disconnect();
  process.exit(1);
});

process.on("unhandledRejection", async (error) => {
  console.error("Unhandled Rejection:", error);
  await prisma.$disconnect();
  process.exit(1);
});

export default prisma;
