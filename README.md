# Chugmania

## Developing

1. Install and run [Docker Desktop](https://www.docker.com/products/docker-desktop/)
1. Run the devcontainer in VSCode

## Deploying

Deploy using the following `docker-compose.yml` template:

```yml
services:
  chugmania:
    container_name: chugmania
    image: mrkalle/chugmania:latest
    ports:
      - '<port>:3000'
    env_file: .env
    volumes: ./<appdata>/config:/app/config
    restart: always
```

with the following dotenv file:

```
NODE_ENV=production
ORIGIN=https://chugmania.kallerud.no
PRIVATE_KEY=<private_key>
ISSUER=kallerud.no
TOKEN_EXPIRY=7d
DATABASE=config/local.db
```
