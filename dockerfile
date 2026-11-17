FROM oven/bun:1.4.4-slim AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.4.4-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle
RUN mkdir -p data && chown nobody:nogroup data

USER nobody:nogroup
VOLUME ["/app/data"]
EXPOSE 6996

CMD ["bun", "run", "start"]
