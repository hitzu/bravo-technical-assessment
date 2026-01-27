#
# Demo image: backend (NestJS + cron) + built frontend served statically.
#

FROM node:22-bookworm-slim AS build

WORKDIR /repo

# Enable pnpm via Corepack (Node 22)
RUN corepack enable

# Copy manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json

RUN pnpm install --frozen-lockfile

# Copy the rest of the repo and build
COPY . .

# Build backend
RUN pnpm build

# Build frontend (baked-in API base URL; defaults to localhost:3000)
ARG VITE_API_BASE_URL="http://localhost:3000"
RUN VITE_API_BASE_URL="$VITE_API_BASE_URL" pnpm --filter frontend build


FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=local
ENV PORT=3000
ENV FRONTEND_PORT=4173

RUN corepack enable

# The entrypoint uses bash features (wait -n, traps).
RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install only production deps for the backend workspace package
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
# Avoid running lifecycle scripts (e.g. "prepare" -> husky) inside the image.
RUN pnpm --filter bravo-technical-assessment... install --prod --frozen-lockfile --ignore-scripts

# App artifacts
COPY --from=build /repo/dist ./dist
COPY --from=build /repo/frontend/dist ./frontend-dist
COPY scripts ./scripts

# Ensure entrypoint script is executable
RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3000 4173

CMD ["bash", "./scripts/docker-entrypoint.sh"]

