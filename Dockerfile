# Stage 1: Install dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

RUN npm run build

# Stage 3: Runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/app
ENV XDG_CONFIG_HOME=/app/.config
ENV XDG_CACHE_HOME=/app/.cache

# Install Chromium and required fonts for Puppeteer using --no-install-recommends
# This avoids installing 250MB+ of unnecessary desktop/printer/samba packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    chromium \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install drizzle-kit and tsx for migrations
RUN npm install -g drizzle-kit tsx

# Add a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create uploads directory
RUN mkdir -p /app/uploads /app/.config /app/.cache && chown -R nextjs:nodejs /app/uploads /app/.config /app/.cache

# Copy built files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# IMPORTANT: Copy the db folder (schema) and drizzle folder (migrations)
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Shell script for more robust startup with better logging
CMD ["sh", "-c", " \
    echo 'Running database migrations...'; \
    if drizzle-kit push; then \
        echo 'Migrations successful. Starting the server...'; \
    else \
        echo 'WARNING: Migrations failed. Check your database connection. Starting server anyway...'; \
    fi; \
    node server.js"]
