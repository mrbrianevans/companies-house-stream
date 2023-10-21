FROM oven/bun as builder

WORKDIR /companies-stream/server

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun build src/chStreamToRedis/streamToRedis.ts --outdir dist --target=node
# hack to fix Bun bundler https://github.com/oven-sh/bun/issues/6168
RUN echo 'import { createRequire as createImportMetaRequire } from "module"; import.meta.require ||= (id) => createImportMetaRequire(import.meta.url)(id);' | cat - dist/streamToRedis.js > temp && mv temp dist/streamToRedis.js


FROM node:20

WORKDIR /companies-stream/server

COPY --from=builder /companies-stream/server/dist /companies-stream/server/dist
COPY --from=builder /companies-stream/server/package.json /companies-stream/server/package.json

CMD ["node", "dist/streamToRedis.js"]
