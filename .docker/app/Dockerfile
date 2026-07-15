FROM node:22-alpine AS base
WORKDIR /app
EXPOSE 5173
RUN npm install -g npm@latest \
  && npm cache clean --force

FROM base AS development
COPY --chown=node:node --chmod=755 .docker/app/entrypoint.sh /entrypoint.sh
COPY --chown=node:node app ./
RUN chown node:node /app
USER node
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM base AS production
COPY --chown=node:node app ./
RUN npm install \
  && npm run build
USER node
CMD ["npm", "run", "preview"]
