FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV WA_AUTH_DIR=/app/baileys_auth

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# Buat direktori auth untuk sesi WhatsApp
RUN mkdir -p /app/baileys_auth

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
