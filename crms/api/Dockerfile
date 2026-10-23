FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY api/package*.json ./
RUN npm install
COPY api/tsconfig.json ./
COPY api/src ./src
COPY api/scripts ./scripts
COPY database ./database
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY api/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/database ./database
RUN chown -R node:node /app
USER node
EXPOSE 4000
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/src/server.js"]
