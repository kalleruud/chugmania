FROM node:alpine
WORKDIR /app

EXPOSE 6996

COPY . .

RUN npm ci
RUN npm run build
RUN mkdir -p data && chown -R node:node data
RUN npm run db:push

ENTRYPOINT ["npm", "run", "prod"]
