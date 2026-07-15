// Package config provides application configuration loaded from environment variables.
package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the application.
type Config struct {
	// Port is the HTTP server listen port.
	Port string

	// DatabaseURL is the PostgreSQL connection string.
	DatabaseURL string

	// RedisURL is the Redis connection string. Empty means Redis is not used (MVP mode).
	RedisURL string

	// JWTSecret is the secret key for JWT token signing.
	JWTSecret string

	// MinIO configuration for object storage.
	MinIOEndpoint  string
	MinIOAccessKey string
	MinIOSecretKey string
	MinIOBucket    string
	MinIOUseSSL    bool

	// UploadDir is the local fallback directory when MinIO is unavailable (MVP fallback).
	UploadDir string

	// RateLimit is the maximum requests per second per IP.
	RateLimit int

	// LogLevel controls the structured logging verbosity: debug, info, warn, error.
	LogLevel string
}

// Load reads configuration from environment variables with sensible defaults for MVP.
// In production, all sensitive values (JWTSecret, MinIO keys, DB password) should be set
// via environment variables, never hardcoded.
func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://dc_user:dc_pass@localhost:5432/dc_center?sslmode=disable"),
		RedisURL:        getEnv("REDIS_URL", ""), // Empty = MVP mode (no Redis)
		JWTSecret:       getEnv("JWT_SECRET", "dc-center-mvp-dev-secret-change-in-production"),
		MinIOEndpoint:   getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey:  getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey:  getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinIOBucket:     getEnv("MINIO_BUCKET", "dc-center"),
		MinIOUseSSL:     getEnvBool("MINIO_USE_SSL", false),
		UploadDir:       getEnv("UPLOAD_DIR", "./uploads"), // Local fallback directory
		RateLimit:       getEnvInt("RATE_LIMIT", 100),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}
