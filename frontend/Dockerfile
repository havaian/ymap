# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps (uses package-lock.json)
COPY package*.json ./
RUN npm ci

# Build Nuxt (default nitro preset = node-server -> .output/server/index.mjs)
COPY . .
RUN npm run build

# Production stage - Nuxt Nitro node server
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Only the build output is needed at runtime
COPY --from=builder /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
