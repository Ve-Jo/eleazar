FROM oven/bun:1 as builder

WORKDIR /app

# Copy package files
COPY package*.json bun.lockb ./
COPY prisma ./prisma/

# Install dependencies
RUN bun install --no-postinstall=false

# Generate Prisma Client
RUN bunx prisma generate

# Copy source code
COPY . .

# Production stage
FROM oven/bun:1

WORKDIR /app

# Copy package files and built assets
COPY --from=builder /app/package*.json /app/bun.lockb ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src

# Set production environment
ENV NODE_ENV=production

# Run migrations and start the bot
CMD bunx prisma migrate deploy && bun . 