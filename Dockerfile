FROM node:20-alpine

WORKDIR /app

COPY backend/package.json ./
RUN npm install --production

COPY backend/ ./
COPY frontend/ ./frontend/

RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
