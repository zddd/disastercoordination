// Package push provides a generic push notification interface for multiple platforms.
// MVP implementation uses LogProvider (logs only). Full version (T12) adds real providers.
// See design §12.5 for the complete push strategy.
package push

import (
	"context"
	"log/slog"
	"time"
)

// Message represents a push notification to be sent to users.
type Message struct {
	Title       string            `json:"title"`
	Content     string            `json:"content"`
	Platform    string            `json:"platform"` // wechat, qq, sms, voice
	TargetUsers []string          `json:"target_users"`
	Level       Level             `json:"level"`
	Link        string            `json:"link,omitempty"`
	TTL         time.Duration     `json:"-"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// Level defines the priority of a push notification.
type Level string

const (
	LevelCritical Level = "critical" // 强制置顶通知 (红色/橙色预警)
	LevelNormal   Level = "normal"   // 普通通知 (黄色/蓝色预警)
	LevelLow      Level = "low"      // 静默通知 (解散/解除通知)
)

// Provider defines the interface for sending push notifications.
// Each platform (WeChat, QQ, SMS, Voice) implements this interface.
// MVP uses LogProvider; full version T12 adds real implementations.
type Provider interface {
	Send(ctx context.Context, msg *Message) (string, error)
	PlatformName() string
}

// LogProvider logs push messages to structured logs instead of sending real notifications.
// Used in MVP phase. In full version, add WeChatProvider, SMSProvider, etc.
type LogProvider struct {
	name string
}

// NewLogProvider creates a log-only push provider for a given platform.
func NewLogProvider(name string) *LogProvider {
	return &LogProvider{name: name}
}

func (p *LogProvider) Send(ctx context.Context, msg *Message) (string, error) {
	slog.InfoContext(ctx, "push notification (MVP log only)",
		"platform", p.name,
		"title", msg.Title,
		"level", msg.Level,
		"target_count", len(msg.TargetUsers),
		"content_preview", truncate(msg.Content, 50),
	)
	return "log-mvp-" + time.Now().Format("20060102150405"), nil
}

func (p *LogProvider) PlatformName() string {
	return p.name
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
