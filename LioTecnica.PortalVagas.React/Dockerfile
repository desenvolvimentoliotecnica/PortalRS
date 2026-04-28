FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
# `npm install` evita falha de `npm ci` quando lock ainda não foi commitado após alterações em package.json
RUN npm install --no-audit --no-fund

COPY . .

ARG VITE_API_BASE_URL=http://localhost:7073
ARG VITE_DEFAULT_TENANT=liotecnica
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_DEFAULT_TENANT=${VITE_DEFAULT_TENANT}

RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
