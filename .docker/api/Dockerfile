FROM node:24.18.0-alpine3.24 AS base
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
# Stamped once per image build (not per container start), so the "new version
# available" check on the frontend fires on real deploys, not plain restarts.
RUN date -u +%Y%m%dT%H%M%SZ > /app/BUILD_ID

FROM base AS production
RUN npm uninstall -g npm corepack
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./
COPY --chown=node:node --from=build /app/BUILD_ID ./BUILD_ID
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/v1/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
