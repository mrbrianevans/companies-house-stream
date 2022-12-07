FROM node:19
RUN corepack enable && corepack prepare pnpm@7.18.1 --activate
WORKDIR /client
COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

CMD ["pnpm", "run", "build"]
