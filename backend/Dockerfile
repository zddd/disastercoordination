# Backend Dockerfile — multi-stage build for Go + Gin API server
# Stage 1: Build the Go binary
# Stage 2: Run from minimal alpine image

# ---- Build Stage ----
FROM golang:1.22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Cache dependency downloads
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
# CGO_ENABLED=0 ensures a fully static binary (no libc dependency)
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# ---- Run Stage ----
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

# Create non-root user for security
RUN adduser -D -g '' appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations

# Use non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENV GIN_MODE=release

CMD ["./server"]
