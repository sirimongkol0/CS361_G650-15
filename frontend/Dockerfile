# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Browser-side base URL (download links, Swagger link). The browser is outside
# the Docker network, so this must be a host-reachable address, NOT a service name.
ARG NEXT_PUBLIC_API_BROWSER_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_BROWSER_URL=$NEXT_PUBLIC_API_BROWSER_URL

RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]