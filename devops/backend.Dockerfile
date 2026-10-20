FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY frontend/public frontend/public
RUN npm run db:generate && npm run build -w backend
WORKDIR /app/backend
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm start"]
