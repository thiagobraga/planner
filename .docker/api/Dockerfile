FROM node:22.23.1-alpine3.24 AS api-base
WORKDIR /app
EXPOSE 4000

FROM api-base AS development
COPY --chown=node:node --chmod=755 .docker/api/entrypoint.sh /entrypoint.sh
COPY --chown=node:node api ./
RUN chown node:node /app
USER node
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM api-base AS production
COPY --chown=node:node api ./
RUN npm install \
  && npm run build
USER node
CMD ["node", "dist/index.js"]
