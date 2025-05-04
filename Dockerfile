FROM oven/bun:1-alpine as builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev postgresql-dev

# Copy only package.json first (without the existing lockfile)
COPY package.json ./

# Install dependencies with production flag and generate a new lockfile
RUN bun install --production

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN bunx prisma generate

# Copy source code
COPY . .

# Production stage with smaller image
FROM oven/bun:1-alpine

WORKDIR /app

RUN apk add --no-cache cairo jpeg pango giflib postgresql-client

# Create a non-root user
RUN addgroup -S appuser && adduser -S appuser -G appuser

# Copy only necessary files from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/bot.js ./bot.js
COPY --from=builder /app/package.json ./package.json

# Fix permissions for the non-root user
RUN mkdir -p /app/node_modules/.prisma/client && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port if needed for preview server
EXPOSE 2333

# Configure memory limits for Node.js
ENV NODE_OPTIONS="--max-old-space-size=512"

# Run with db push instead of migrations for existing databases
CMD export DATABASE_URL=$PG_DATABASE_URL && bunx prisma generate --accept-data-loss && bunx prisma db push && bun --expose-gc --smol . 