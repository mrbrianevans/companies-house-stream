FROM node:18

WORKDIR client

COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@7.1.2 --activate && pnpm install # installs pnpm

COPY . .


CMD ["pnpm", "run", "build"]
