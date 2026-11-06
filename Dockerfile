# Production image of the Choronai frontend (Next.js).
# Built and started by compose.prod.yaml in the backend repo (deploy/).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# The standalone server plus the files it serves directly.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Sign-in sessions of the local fallback mode live here (a volume).
RUN mkdir -p /data && chown node:node /data
ENV CHORONAI_DB_PATH=/data/choronai.sqlite
USER node
EXPOSE 3000
CMD ["node", "server.js"]
