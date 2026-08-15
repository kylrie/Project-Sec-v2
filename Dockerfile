# Use official Node.js 22 image
FROM node:22-slim

# Install Python and build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (for layer caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app (Vite frontend + Express backend)
RUN npm run build

# Expose the port Railway will use
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.cjs"]
