# Backend Dockerfile - Production-ready Node.js 18 Alpine
FROM node:18-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

# Build stage (for production)
FROM base AS build
ENV NODE_ENV=production
RUN npm install --production
COPY . .

# Production stage
FROM node:18-alpine AS production
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy node_modules and app from build stage
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/src ./src
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Create logs and uploads directories
RUN mkdir -p logs uploads/avatars && chown nodejs:nodejs logs uploads

USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/server.js"]
