# WhatsApp AI Agents - Docker Image
FROM node:20-slim

# Install dependencies for Puppeteer (optional, for full web agent)
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/local-agent/package*.json ./apps/local-agent/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/local-agent ./apps/local-agent

# Build shared package
RUN cd packages/shared && npm run build

# Environment variables (override with -e or .env file)
ENV PORT=3001
ENV POLLING_INTERVAL=2
ENV FILES_BASE_DIR=/data
ENV DATA_DIR=/data/.whatsapp-agents

# Create data directory
RUN mkdir -p /data/.whatsapp-agents

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the agent
CMD ["npm", "run", "dev:local"]
