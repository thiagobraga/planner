FROM node:26.12.1-alpine3.24 AS build
WORKDIR /workspace/site
COPY --chown=node:node site/package.json site/package-lock.json site/.npmrc ./
RUN npm ci
COPY --chown=node:node site ./
COPY --chown=node:node app/src/styles/theme.css /workspace/app/src/styles/theme.css
ARG VITE_APP_URL=https://planner.thiagobraga.dev
ENV VITE_APP_URL=$VITE_APP_URL
RUN npm run build && npm cache clean --force

FROM node:26.12.1-alpine3.24 AS development
WORKDIR /workspace/site
RUN apk upgrade --no-cache && apk add --no-cache chromium \
    && mkdir -p node_modules && chown -R node:node /workspace
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY --chown=node:node --chmod=755 .docker/site/entrypoint.sh /entrypoint.sh
COPY --chown=node:node site ./
COPY --chown=node:node app/src/styles/theme.css /workspace/app/src/styles/theme.css
ARG DOCKER_USER=1000:1000
ENV NPM_CONFIG_CACHE=/tmp/npm-cache
RUN mkdir -p /tmp/npm-cache && chown -R "$DOCKER_USER" /workspace /tmp/npm-cache
USER $DOCKER_USER
EXPOSE 5174
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5174/ || exit 1
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM nginx:1.31.8-alpine AS production
ARG APK_REFRESH
RUN apk upgrade --no-cache
COPY --from=build /workspace/site/dist /usr/share/nginx/html
COPY .docker/site/nginx.conf /etc/nginx/conf.d/default.conf
RUN mkdir -p /var/run/nginx && chown -R nginx:nginx /var/cache/nginx /var/run/nginx /etc/nginx/conf.d
USER nginx
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
