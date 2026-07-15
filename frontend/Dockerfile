# Frontend Dockerfile — multi-stage build for Next.js standalone mode
# See design §1.3: standalone mode enables Docker deployment without Vercel.
# No Edge Runtime dependency — all logic runs in Node.js.

# ---- Dependencies Stage ----
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Cache npm install
COPY package.json package-lock.json* ./
RUN npm ci --only=production 2>/dev/null || npm install

# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Run Stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "server.js"]
