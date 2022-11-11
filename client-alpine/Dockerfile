FROM node:18
RUN corepack enable && corepack prepare pnpm@7.9.3 --activate
WORKDIR /client
COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

CMD ["pnpm", "run", "build"]
