FROM oven/bun as builder

WORKDIR /companies-stream/server

COPY package.json bun.lock ./
RUN bun install --omit=dev

COPY . .

RUN bun build --compile --minify --sourcemap --target=bun-linux-x64-modern ./src/api/server.ts --outfile apiServer

EXPOSE 3000

CMD ./apiServer
