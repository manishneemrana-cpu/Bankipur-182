# API + worker image (same code, different command). Build from the video-engine/ directory.
FROM node:22-bookworm-slim
# Chromium runtime libs for Remotion's headless shell, a full chromium for Puppeteer map capture,
# and fonts (Devanagari!) so Hindi text renders in map labels and videos.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-noto-core fonts-noto-ui-core fonts-noto-color-emoji ca-certificates \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 \
    libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/
COPY apps/web-admin/package.json apps/web-admin/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/video-template/package.json packages/video-template/
RUN npm ci
COPY . .
# Pre-download Remotion's chrome-headless-shell so the first render isn't slow
RUN node -e "import('@remotion/renderer').then(m=>m.ensureBrowser())"
ENV NODE_ENV=production
EXPOSE 4100
CMD ["node", "--import", "tsx", "apps/worker/src/api.ts"]
