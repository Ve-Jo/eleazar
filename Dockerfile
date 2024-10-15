# Use a lightweight base image with Bun installed
FROM oven/bun:latest AS builder

# Set the working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY bun.lockb ./

# Install dependencies without using a frozen lockfile
RUN bun install --no-frozen-lockfile

# Copy the rest of the application code
COPY . .

# Use a smaller base image for the final build
FROM alpine:latest

# Install necessary dependencies for running Bun
RUN apk add --no-cache libstdc++ libc6-compat

# Set the working directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app /app

# Expose necessary ports
EXPOSE 3000

# Define the command to run the bot
CMD ["bun", "--smol", "."]