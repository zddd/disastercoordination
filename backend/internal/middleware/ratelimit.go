package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimit returns a simple in-memory token-bucket rate limiter middleware.
// For MVP this is per-process in-memory. In full version, replace with Redis-based limiter.
// rps = maximum requests per second per IP.
func RateLimit(rps int) gin.HandlerFunc {
	type bucket struct {
		count   int
		resetAt int64 // unix second boundary
	}

	var (
		mu  sync.Mutex
		buckets = make(map[string]*bucket)
	)

	// Periodic cleanup goroutine to prevent unbounded memory growth
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			mu.Lock()
			now := time.Now().Unix()
			for ip, b := range buckets {
				if now >= b.resetAt {
					delete(buckets, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now().Unix()

		mu.Lock()
		b, exists := buckets[ip]
		if !exists || now >= b.resetAt {
			// New time window (1 second)
			buckets[ip] = &bucket{count: 1, resetAt: now + 1}
			mu.Unlock()
			c.Next()
			return
		}

		if b.count >= rps {
			mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded, try again later",
			})
			return
		}

		b.count++
		mu.Unlock()
		c.Next()
	}
}
