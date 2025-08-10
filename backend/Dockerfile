# ================================
# Production-Ready Backend Dockerfile
# Optimized for Render.com deployment
# ================================

FROM node:18-alpine

# Install required packages for production
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    ca-certificates \
    tini \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production --frozen-lockfile && \
    npm cache clean --force

# Copy application source code
COPY src/ ./src/
COPY database/ ./database/

# Create necessary directories
RUN mkdir -p /app/audios /app/logs && \
    chmod -R 755 /app

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=1024"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ping || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "src/app.js"]
