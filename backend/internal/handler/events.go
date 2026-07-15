package handler

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// SSEEvent represents a server-sent event pushed to clients.
type SSEEvent struct {
	Type    string      `json:"type"`    // task_status_change, new_task, alert, keepalive
	Payload interface{} `json:"payload"`
}

// SSEBroker manages SSE client connections and event distribution by role.
// In full version, replace with WebSocket + Redis Pub/Sub for horizontal scaling.
type SSEBroker struct {
	mu      sync.RWMutex
	clients map[string]*sseClient
}

type sseClient struct {
	id   string
	role string
	ch   chan SSEEvent
	done chan struct{}
}

// NewSSEBroker creates a new SSE broker.
func NewSSEBroker() *SSEBroker {
	return &SSEBroker{
		clients: make(map[string]*sseClient),
	}
}

// Subscribe adds a new client and returns an event channel + unsubscribe function.
func (b *SSEBroker) Subscribe(clientID, role string) (<-chan SSEEvent, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()

	client := &sseClient{
		id:   clientID,
		role: role,
		ch:   make(chan SSEEvent, 20),
		done: make(chan struct{}),
	}
	b.clients[clientID] = client

	slog.Debug("SSE client connected", "client_id", clientID, "role", role, "total", len(b.clients))

	return client.ch, func() {
		b.mu.Lock()
		delete(b.clients, clientID)
		close(client.done)
		b.mu.Unlock()
		slog.Debug("SSE client disconnected", "client_id", clientID, "total", len(b.clients))
	}
}

// Publish sends an event to clients matching the role filter (empty = broadcast to all).
func (b *SSEBroker) Publish(event SSEEvent, roleFilter string) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, client := range b.clients {
		if roleFilter == "" || client.role == roleFilter {
			select {
			case client.ch <- event:
			default:
				slog.Warn("SSE client buffer full", "client_id", client.id, "event", event.Type)
			}
		}
	}
}

// ActiveClients returns current connected count.
func (b *SSEBroker) ActiveClients() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.clients)
}

// SSEHandler handles SSE event streaming endpoints.
type SSEHandler struct {
	broker *SSEBroker
}

func NewSSEHandler(broker *SSEBroker) *SSEHandler {
	return &SSEHandler{broker: broker}
}

// Subscribe handles GET /api/v1/events/subscribe.
// Streams Server-Sent Events with role-filtered task updates and alerts.
func (h *SSEHandler) Subscribe(c *gin.Context) {
	role := c.Query("role")
	if role == "" {
		role = c.GetString("user_role")
	}

	clientID := fmt.Sprintf("%s-%d", c.ClientIP(), time.Now().UnixNano())

	// SSE response headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	ch, unsubscribe := h.broker.Subscribe(clientID, role)
	defer unsubscribe()

	slog.Info("SSE connected", "client", clientID, "role", role, "active", h.broker.ActiveClients())

	// Initial connected event
	c.SSEvent("connected", gin.H{"client_id": clientID, "role": role})
	c.Writer.Flush()

	keepalive := time.NewTicker(30 * time.Second)
	defer keepalive.Stop()

	for {
		select {
		case event := <-ch:
			c.SSEvent(event.Type, event.Payload)
			c.Writer.Flush()
		case <-keepalive.C:
			c.SSEvent("keepalive", gin.H{"time": time.Now().Unix()})
			c.Writer.Flush()
		case <-c.Request.Context().Done():
			return
		}
	}
}
