FROM node:26.5.0-alpine3.24 AS base
WORKDIR /app
RUN apk add --no-cache tini
EXPOSE 4000

FROM base AS development
COPY --chown=node:node --chmod=755 .docker/api/entrypoint.sh /entrypoint.sh
COPY --chown=node:node api ./
RUN chown node:node /app
USER node
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM base AS build
COPY --chown=node:node api ./
RUN npm ci && \
    npm run build && \
    rm -rf node_modules && \
    npm ci --omit=dev --production && \
    npm cache clean --force

FROM base AS production
RUN npm uninstall -g npm corepack
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/v1/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
