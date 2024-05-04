FROM oven/bun as builder

WORKDIR /companies-stream/server

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

# disconnect event doesn't work on bun the same way as node. needs debugging and reporting to Bun or changing implementation.
# from some cursory debugging, it seems the "end" event isn't being emmited when running in bun when a stream is closed by CH.
# RUN bun build --compile --minify --sourcemap --target=bun-linux-x64-modern ./src/chStreamToRedis/streamToRedis.ts --outfile streamToRedis
#CMD ./streamToRedis

RUN bun build src/chStreamToRedis/streamToRedis.ts --outdir dist --target=node

FROM node:22

WORKDIR /companies-stream/server

COPY --from=builder /companies-stream/server/dist /companies-stream/server/dist
COPY --from=builder /companies-stream/server/package.json /companies-stream/server/package.json

CMD ["node", "dist/streamToRedis.js"]
