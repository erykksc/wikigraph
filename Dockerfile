FROM node:24-alpine AS build

WORKDIR /app

ARG APP_BASE_PATH=/

COPY package.json package-lock.json ./

RUN npm ci

COPY src ./src
COPY public ./public
COPY index.html ./index.html
COPY vite.config.ts ./vite.config.ts
COPY eslint.config.js ./eslint.config.js
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.app.json ./tsconfig.app.json
COPY tsconfig.node.json ./tsconfig.node.json

RUN APP_BASE_PATH="$APP_BASE_PATH" npm run build

FROM caddy:2-alpine AS runtime

COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
