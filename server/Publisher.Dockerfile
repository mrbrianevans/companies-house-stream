FROM oven/bun as builder

WORKDIR /companies-stream/server

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun build --compile --minify --sourcemap --target=bun-linux-x64-modern ./src/chStreamToRedis/streamToRedis.ts --outfile streamToRedis

CMD ["./streamToRedis"]
