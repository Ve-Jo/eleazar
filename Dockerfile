FROM oven/bun:1-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json bun.lockb ./

# Install dependencies with production flag
RUN bun install --production --no-progress

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN bunx prisma generate

# Copy source code
COPY . .

# Production stage with smaller image
FROM oven/bun:1-alpine

WORKDIR /app

# Copy only necessary files from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/bot.js ./bot.js
COPY --from=builder /app/package.json ./package.json

# Set production environment
ENV NODE_ENV=production

# Use a non-root user for security
RUN addgroup -S appuser && adduser -S appuser -G appuser
USER appuser

# Expose port if needed for preview server
EXPOSE 2333

# Configure memory limits for Node.js
ENV NODE_OPTIONS="--max-old-space-size=512"

# Run migrations and start the bot with garbage collection enabled
CMD export DATABASE_URL=$PG_DATABASE_URL && bunx prisma generate && bunx prisma migrate deploy && bun --expose-gc . 