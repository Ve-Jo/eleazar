FROM oven/bun:1 as builder

WORKDIR /app

# Copy package files
COPY package*.json bun.lockb ./

# Install dependencies including Prisma
RUN bun install --no-postinstall=false

# Copy prisma schema
COPY prisma ./prisma/

# Copy source code
COPY . .

# Generate Prisma Client
RUN bunx prisma generate

# Production stage
FROM oven/bun:1

WORKDIR /app

# Copy all files from builder
COPY --from=builder /app .

# Set production environment
ENV NODE_ENV=production

# Run migrations and start the bot
CMD export DATABASE_URL=$PG_DATABASE_URL && bunx prisma generate && bunx prisma migrate deploy && bun . 