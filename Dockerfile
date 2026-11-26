# syntax=docker/dockerfile:1
# Image giao dien (nginx tinh). Build tu thu muc frontend/:  docker build -t cmsvn-web:dev .
# nginx phuc vu file tinh va proxy /api, /hubs sang container "api" (xem deploy/docker/docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY deploy-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
