FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY frontend frontend
RUN npm run db:generate && npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/backend backend
COPY --from=build /app/frontend/dist frontend/dist
COPY --from=build /app/frontend/public frontend/public
ENV NODE_ENV=production PORT=3000 FRONTEND_DIST=/app/frontend/dist DATABASE_URL=file:/app/backend/data/onlycats.db
WORKDIR /app/backend
RUN mkdir -p uploads data && chown -R node:node uploads data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npm run db:migrate && exec node dist/src/main.js"]
