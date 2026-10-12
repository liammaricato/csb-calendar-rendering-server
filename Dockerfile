FROM node:22-bookworm-slim

# Debian's Chromium; Puppeteer uses it instead of downloading its own Chrome
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY . .

RUN useradd -m csb && chown -R csb /app
USER csb

HEALTHCHECK --interval=1m --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
