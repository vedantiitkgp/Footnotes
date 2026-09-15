# ── Stage 1: Build the React frontend ─────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production server ─────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install backend production dependencies only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend/public (Express will serve it as static files)
COPY --from=frontend-builder /build/frontend/dist ./public

# Create temp directory for session uploads/assets
RUN mkdir -p ./temp

EXPOSE 3001

CMD ["node", "server.js"]
