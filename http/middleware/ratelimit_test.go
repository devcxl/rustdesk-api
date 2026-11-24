package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestMatchRateLimitRule(t *testing.T) {
	tests := []struct {
		path      string
		wantLimit int
		wantPath  string // empty for the default rule
	}{
		{"/api/oidc/auth", 30, "/api/oidc/auth"},
		{"/api/admin/oidc/auth", 30, "/api/admin/oidc/auth"},
		{"/api/oidc/auth-query", 120, "/api/oidc/auth-query"},
		{"/api/admin/oidc/auth-query", 120, "/api/admin/oidc/auth-query"},
		{"/api/oidc/callback", 60, "/api/oidc/"},
		{"/api/oauth/callback", 60, "/api/oauth/"},
		{"/api/sysinfo", 300, "/api/sysinfo"},
		{"/api/heartbeat", 6000, "/api/heartbeat"},
		{"/api/users", defaultRateLimit, ""},
		{"/api/oidc", defaultRateLimit, ""},
		{"/api/admin/oauth/info", defaultRateLimit, ""},
	}
	for _, tc := range tests {
		rule := matchRateLimitRule(tc.path)
		if rule.limit != tc.wantLimit || rule.path != tc.wantPath {
			t.Errorf("matchRateLimitRule(%q) = {path:%q limit:%d}, want {path:%q limit:%d}",
				tc.path, rule.path, rule.limit, tc.wantPath, tc.wantLimit)
		}
	}
}

func TestAuthQueryNotLimitedByAuthMintBucket(t *testing.T) {
	for _, path := range []string{"/api/oidc/auth-query", "/api/admin/oidc/auth-query"} {
		rule := matchRateLimitRule(path)
		if rule.limit != 120 {
			t.Fatalf("matchRateLimitRule(%q).limit = %d, want 120", path, rule.limit)
		}
		if rule.path != path {
			t.Fatalf("matchRateLimitRule(%q) matched rule %q, want exact auth-query rule", path, rule.path)
		}
	}
}

func TestFixedWindowLimiterDeniesAfterLimit(t *testing.T) {
	current := time.Date(2026, 1, 1, 10, 0, 10, 0, time.UTC)
	l := newFixedWindowLimiter()
	l.now = func() time.Time { return current }

	for i := 0; i < 3; i++ {
		if !l.allow("ip", 3) {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
	if l.allow("ip", 3) {
		t.Fatal("request over the limit should be denied")
	}
	if !l.allow("other-ip", 3) {
		t.Fatal("a different key must have its own bucket")
	}

	// The next fixed window resets the counter.
	current = current.Add(rateLimitWindow)
	if !l.allow("ip", 3) {
		t.Fatal("request in the next window should be allowed")
	}
}

func TestSensitiveRateLimitMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousLimiter := sensitiveRateLimiter
	sensitiveRateLimiter = newFixedWindowLimiter()
	t.Cleanup(func() { sensitiveRateLimiter = previousLimiter })

	r := gin.New()
	r.Use(SensitiveRateLimit())
	r.Any("/*any", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	do := func(path string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, path, nil)
		req.RemoteAddr = "203.0.113.7:1234"
		r.ServeHTTP(w, req)
		return w
	}

	for i := 0; i < 30; i++ {
		if w := do("/api/oidc/auth"); w.Code != http.StatusOK {
			t.Fatalf("auth request %d: code = %d, want 200", i+1, w.Code)
		}
	}
	w := do("/api/oidc/auth")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("auth request over limit: code = %d, want 429", w.Code)
	}
	if body := w.Body.String(); body != `{"error":"Too Many Requests"}` {
		t.Fatalf("429 body = %q", body)
	}

	// Auth-query polling from the same IP has its own 120/min bucket, so it
	// must keep working past the 30/min auth-mint limit.
	for path, polls := range map[string]int{
		"/api/oidc/auth-query":       40,
		"/api/admin/oidc/auth-query": 40,
	} {
		for i := 0; i < polls; i++ {
			if w := do(path); w.Code != http.StatusOK {
				t.Fatalf("%s poll %d: code = %d, want 200", path, i+1, w.Code)
			}
		}
	}
}
