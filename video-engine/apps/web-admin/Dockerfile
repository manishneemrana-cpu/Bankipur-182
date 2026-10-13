FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web-admin/package.json apps/web-admin/
COPY apps/worker/package.json apps/worker/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/video-template/package.json packages/video-template/
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are inlined at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:4100/api
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build -w @ave/web-admin
ENV NODE_ENV=production
EXPOSE 3100
CMD ["npm", "run", "start", "-w", "@ave/web-admin"]
