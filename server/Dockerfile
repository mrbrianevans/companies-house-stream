FROM oven/bun

WORKDIR /companies-stream/server

COPY package.json bun.lockb ./
RUN bun install --omit=dev

COPY . .

EXPOSE 3000

CMD ["bun", "start"]
