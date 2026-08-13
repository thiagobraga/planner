FROM node:26.7.0-alpine3.24 AS build
WORKDIR /app
COPY --chown=node:node app ./
RUN npm ci && npm run build && npm cache clean --force

FROM node:26.7.0-alpine3.24 AS development
WORKDIR /app
COPY --chown=node:node --chmod=755 .docker/app/entrypoint.sh /entrypoint.sh
COPY --chown=node:node app ./
EXPOSE 5173
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM nginx:1.31-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY .docker/app/nginx.conf /etc/nginx/conf.d/default.conf
RUN mkdir -p /var/run/nginx && chown -R nginx:nginx /var/cache/nginx /var/run/nginx /etc/nginx/conf.d
USER nginx
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
