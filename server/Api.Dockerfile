FROM oven/bun as builder

WORKDIR /companies-stream/server

COPY package.json bun.lockb ./
RUN bun install --omit=dev

COPY . .

RUN bun build --compile --minify --sourcemap --target=bun-linux-x64-modern ./src/api/server.ts --outfile apiServer

EXPOSE 3000

CMD ./apiServer

#FROM alpine
#
#WORKDIR /companies-stream/server
#
#COPY --chmod=0775 --from=builder /companies-stream/server/apiServer ./apiServer
#RUN chmod +x apiServer
