FROM node:alpine AS build

WORKDIR /app

ARG DATABASE config/local.db
ENV DATABASE $DATABASE

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN mkdir -p config
RUN npm run build
RUN npm run db:migrate

FROM node:alpine AS run

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/config ./config

RUN ulimit -c unlimited

ENTRYPOINT ["node", "build"]