FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./next.config.mjs
RUN addgroup --system --gid 1001 nextjs && adduser --system --uid 1001 nextjs \
  && chown -R nextjs:nextjs /app
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
