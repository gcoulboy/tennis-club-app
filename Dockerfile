FROM node:20-alpine

WORKDIR /app

# Install dependencies (sql.js is pure JS/WASM - no native build needed)
COPY backend/package.json ./
RUN npm install --production

# Copy backend source
COPY backend/ ./

# Copy frontend (served as static files by Express)
COPY frontend/ ./frontend/

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
