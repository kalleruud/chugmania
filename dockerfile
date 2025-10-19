FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json .
RUN npm install

COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json .
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY drizzle.config.ts .
COPY drizzle ./drizzle
RUN mkdir -p data && chown -R node:node data

VOLUME ["/app/data"]
EXPOSE 6996

ENTRYPOINT ["npm", "start"]
