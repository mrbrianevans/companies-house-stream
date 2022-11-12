FROM node:19
RUN corepack enable && corepack prepare pnpm@7.15.0 --activate

WORKDIR /companies-stream/server

COPY package.json pnpm-lock.yaml ./

RUN pnpm i

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"]
