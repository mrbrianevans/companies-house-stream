FROM oven/bun as builder

WORKDIR /companies-stream/server

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun build src/persistence/sqlitePersistence.ts --outdir dist --target=node --packages=external

FROM node:22

WORKDIR /companies-stream/server

COPY --from=builder /companies-stream/server/node_modules /companies-stream/server/node_modules
COPY --from=builder /companies-stream/server/dist /companies-stream/server/dist
COPY --from=builder /companies-stream/server/package.json /companies-stream/server/package.json

CMD ["node", "--max-old-space-size=64", "dist/sqlitePersistence.js"]
