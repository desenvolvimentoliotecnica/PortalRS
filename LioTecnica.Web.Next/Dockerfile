# ====== build ======
FROM node:20-alpine AS build
WORKDIR /app

# Variáveis injetadas em build-time (NEXT_PUBLIC_* são baked no bundle estático)
ARG NEXT_PUBLIC_API_BASE=""
ARG NEXT_PUBLIC_PORTAL_ORIGIN=""

ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_PORTAL_ORIGIN=$NEXT_PUBLIC_PORTAL_ORIGIN

# Instala dependências (cache layer)
COPY LioTecnica.Web.Next/package.json LioTecnica.Web.Next/package-lock.json* ./
RUN npm ci --ignore-scripts

# Copia source e faz o build estático
COPY LioTecnica.Web.Next/ ./
RUN npm run build

# ====== runtime ======
FROM nginx:1.27-alpine AS final

# Remove config default do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Config customizado para SPA (basePath: /app)
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos estáticos gerados pelo Next.js
COPY --from=build /app/out /usr/share/nginx/html/app

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
