FROM node:lts-alpine

WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm install -g pnpm

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm fetch
RUN pnpm install -r --offline

COPY --chown=node:node src/ ./src/
COPY --chown=node:node tsconfig.json ./

RUN pnpm build

USER node

ENTRYPOINT ["pnpm", "run", "start"]
