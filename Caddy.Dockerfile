# Stage 1: Build the client using the official bun image
FROM oven/bun:latest AS builder

# Copy client source files
WORKDIR /app
COPY ./client-pure /app

# Build the client
RUN bun install
RUN bun run build

# Stage 2: Setup Caddy server with the built client
FROM caddy:latest

# Copy Caddyfile and built client files from the builder stage
COPY ./Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist/ /client/