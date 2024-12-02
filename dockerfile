FROM node:alpine AS build

WORKDIR /app

ARG DB_FILE_NAME
ARG PRIVATE_KEY
ARG ISSUER
ARG TOKEN_EXPIRY

ENV DB_FILE_NAME=$DB_FILE_NAME
ENV PRIVATE_KEY=$PRIVATE_KEY
ENV ISSUER=$ISSUER
ENV TOKEN_EXPIRY=$TOKEN_EXPIRY

COPY package*.json .
RUN npm ci

COPY . .
RUN mkdir -p data
RUN npm run db:migrate
RUN npm run build

FROM node:alpine AS run

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/config ./config

RUN ulimit -c unlimited

ENTRYPOINT ["node", "build"]