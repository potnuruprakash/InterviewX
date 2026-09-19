# =============================================================================
# InterviewX Backend Dockerfile
# Production-ready Node.js Express service
# =============================================================================

FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Multi-stage production image
FROM node:20-alpine
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create uploads directory and set permissions
RUN mkdir -p uploads && chown -R appuser:appgroup /usr/src/app

COPY --from=builder --chown=appuser:appgroup /usr/src/app ./

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
