FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY deploy/brain-toolkit ./deploy/brain-toolkit
RUN cd deploy/brain-toolkit && npm ci --omit=dev

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV MEMORY_MCP_HOST=0.0.0.0
ENV MEMORY_MCP_PORT=8080
ENV CLAUDE_DIR=/data/brain
ENV BRAIN_DIR=/app/deploy/brain-toolkit

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
