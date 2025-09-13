FROM oven/bun as builder

WORKDIR /companies-stream/server

COPY package.json bun.lockb ./
RUN bun install --omit=dev

COPY . .

# RUN bun build --compile --minify --sourcemap --target=bun-linux-x64-musl ./src/api/server.ts --outfile apiServer

EXPOSE 3000

# instead of building to a binary, I'm running with bun runtime since there was a bug introduced by compiling.
# started getting "Right side of assignment cannot be destructured" when compiled to binary executable.
CMD bun ./src/api/server.ts

# CMD ./apiServer

#FROM alpine
##
#WORKDIR /companies-stream/server
##
#COPY --chmod=0775 --from=builder /companies-stream/server/apiServer apiServer
#RUN chmod +x apiServer
#
#CMD /companies-stream/server/apiServer