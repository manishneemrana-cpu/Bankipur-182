# Multi-stage build for the VPS/Docker deployment path (Phase 10). Vercel
# deploys don't use this file at all — it's an alternative to Vercel, not a
# wrapper around it.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# `output: "standalone"` (next.config.ts) traces only the files actually
# needed at runtime, so the final image doesn't carry the whole node_modules.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
