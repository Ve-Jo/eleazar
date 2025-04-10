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

# Install runtime dependencies for canvas and other native modules
RUN apk add --no-cache cairo jpeg pango giflib postgresql-client

# Create a non-root user
RUN addgroup -S appuser && adduser -S appuser -G appuser

# Copy only necessary files from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/bot.js ./bot.js
COPY --from=builder /app/package.json ./package.json

# Set production environment
ENV NODE_ENV=production

# Fix permissions for the non-root user
RUN mkdir -p /app/node_modules/.prisma/client && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port if needed for preview server
EXPOSE 2333

# Configure memory limits for Node.js
ENV NODE_OPTIONS="--max-old-space-size=512"

# Create a startup script to handle schema migrations properly
RUN echo '#!/bin/sh\n\
export DATABASE_URL=$PG_DATABASE_URL\n\
echo "Generating Prisma Client..."\n\
bunx prisma generate\n\
\n\
echo "Applying database schema changes..."\n\
bunx prisma db push --skip-generate --accept-data-loss\n\
\n\
echo "Starting bot with garbage collection enabled..."\n\
exec bun --expose-gc .\n\
' > /app/start.sh && chmod +x /app/start.sh

# Use the startup script
CMD ["/app/start.sh"] 