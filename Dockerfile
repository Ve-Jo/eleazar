# Use the official Bun image as the base
FROM oven/bun:latest

# Set the working directory in the container
WORKDIR /app

# Copy package.json and bun.lockb (if it exists)
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

CMD ["bun", "--smol", "."]
