package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	rateLimitWindow  = time.Minute
	defaultRateLimit = 3000
)

type rateLimitMatch int

const (
	matchExact rateLimitMatch = iota
	matchPrefix
)

type rateLimitRule struct {
	path  string
	match rateLimitMatch
	limit int
}

// rateLimitRules is evaluated in order; the first matching rule wins.
// Auth-mint endpoints are exact matches so their bucket does not swallow the
// frequently polled auth-query endpoints.
var rateLimitRules = []rateLimitRule{
	{path: "/api/oidc/auth", match: matchExact, limit: 30},
	{path: "/api/admin/oidc/auth", match: matchExact, limit: 30},
	{path: "/api/oidc/auth-query", match: matchExact, limit: 120},
	{path: "/api/admin/oidc/auth-query", match: matchExact, limit: 120},
	{path: "/api/oidc/", match: matchPrefix, limit: 60},
	{path: "/api/oauth/", match: matchPrefix, limit: 60},
	{path: "/api/heartbeat", match: matchExact, limit: 6000},
	{path: "/api/sysinfo", match: matchPrefix, limit: 300},
}

type rateLimitEntry struct {
	windowStart time.Time
	count       int
}

// fixedWindowLimiter is a best-effort, per-process, in-memory limiter.
// Some over-admission at window boundaries is acceptable.
type fixedWindowLimiter struct {
	mu        sync.Mutex
	entries   map[string]*rateLimitEntry
	lastSweep time.Time
	now       func() time.Time
}

func newFixedWindowLimiter() *fixedWindowLimiter {
	return &fixedWindowLimiter{
		entries: make(map[string]*rateLimitEntry),
		now:     time.Now,
	}
}

func (l *fixedWindowLimiter) allow(key string, limit int) bool {
	now := l.now()
	windowStart := now.Truncate(rateLimitWindow)

	l.mu.Lock()
	defer l.mu.Unlock()

	// Sweep expired entries at most once per window to keep the map bounded.
	if l.lastSweep.IsZero() || now.Sub(l.lastSweep) >= rateLimitWindow {
		for k, entry := range l.entries {
			if now.Sub(entry.windowStart) >= rateLimitWindow {
				delete(l.entries, k)
			}
		}
		l.lastSweep = now
	}

	entry, ok := l.entries[key]
	if !ok || !entry.windowStart.Equal(windowStart) {
		l.entries[key] = &rateLimitEntry{windowStart: windowStart, count: 1}
		return true
	}
	if entry.count >= limit {
		return false
	}
	entry.count++
	return true
}

var sensitiveRateLimiter = newFixedWindowLimiter()

// SensitiveRateLimit throttles sensitive API paths per client IP.
// Limits are fixed windows of one minute and scoped per matching rule.
func SensitiveRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		rule := matchRateLimitRule(c.Request.URL.Path)
		key := rule.path + "|" + c.ClientIP()
		if !sensitiveRateLimiter.allow(key, rule.limit) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too Many Requests"})
			return
		}
		c.Next()
	}
}

func matchRateLimitRule(path string) rateLimitRule {
	for _, rule := range rateLimitRules {
		switch rule.match {
		case matchExact:
			if path == rule.path {
				return rule
			}
		case matchPrefix:
			if strings.HasPrefix(path, rule.path) {
				return rule
			}
		}
	}
	return rateLimitRule{limit: defaultRateLimit}
}
