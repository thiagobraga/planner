FROM node:22-alpine AS base
WORKDIR /app
EXPOSE 4000
RUN npm install -g npm@latest \
  && npm cache clean --force

FROM base AS development
COPY --chown=node:node --chmod=755 .docker/api/entrypoint.sh /entrypoint.sh
COPY --chown=node:node api ./
RUN chown node:node /app
USER node
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM base AS production
COPY --chown=node:node api ./
RUN npm ci \
  && npm run build
CMD ["node", "dist/index.js"]
