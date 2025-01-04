FROM node:alpine AS build

WORKDIR /app

ARG DB_FILE_NAME
ARG PRIVATE_KEY
ARG ISSUER
ARG TOKEN_EXPIRY_H

ENV DB_FILE_NAME=$DB_FILE_NAME
ENV PRIVATE_KEY=$PRIVATE_KEY
ENV ISSUER=$ISSUER
ENV TOKEN_EXPIRY_H=$TOKEN_EXPIRY_H

USER root

COPY package*.json .
RUN npm ci

COPY . .
RUN mkdir -p data && chown -R node:node data
RUN npm run db:migrate
RUN npm run build

RUN ulimit -c unlimited

ENTRYPOINT ["sh", "run.sh"]