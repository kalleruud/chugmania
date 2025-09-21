FROM node:alpine
WORKDIR /app

COPY . .
RUN npm ci --omit-dev && npm run build && mkdir -p data && chown -R node:node data && npm run db:push

EXPOSE 6996

ENTRYPOINT ["npm", "run", "prod"]
