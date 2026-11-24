package service

import (
	"fmt"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/lejianwen/rustdesk-api/v2/config"
	"github.com/sirupsen/logrus"
)

// clearOauthCacheForTest isolates the process-wide OAuth cache from other tests.
func clearOauthCacheForTest(t *testing.T) {
	t.Helper()
	cleanup := func() {
		OauthCache.Range(func(key, _ interface{}) bool {
			OauthCache.Delete(key)
			return true
		})
		atomic.StoreInt64(&oauthCacheCount, 0)
	}
	cleanup()
	t.Cleanup(cleanup)
}

func oauthCacheLen() int {
	count := 0
	OauthCache.Range(func(_, _ interface{}) bool {
		count++
		return true
	})
	return count
}

func TestOauthCacheEnforcesEntryCap(t *testing.T) {
	clearOauthCacheForTest(t)
	svc := &OauthService{}

	for i := 0; i <= maxOauthCacheEntries; i++ {
		svc.SetOauthCache(fmt.Sprintf("cap-%d", i), &OauthCacheItem{}, 0)
	}

	if got := oauthCacheLen(); got != maxOauthCacheEntries {
		t.Fatalf("cache size = %d, want %d", got, maxOauthCacheEntries)
	}
	if got := atomic.LoadInt64(&oauthCacheCount); got != maxOauthCacheEntries {
		t.Fatalf("tracked cache size = %d, want %d", got, maxOauthCacheEntries)
	}

	// Once full, new keys are dropped instead of evicting existing flows.
	svc.SetOauthCache("cap-overflow", &OauthCacheItem{}, 0)
	if svc.GetOauthCache("cap-overflow") != nil {
		t.Fatal("key stored beyond the cap")
	}
	if got := oauthCacheLen(); got > maxOauthCacheEntries {
		t.Fatalf("cache size = %d, must not exceed %d", got, maxOauthCacheEntries)
	}

	// Deleting an entry frees a slot for a new one.
	svc.DeleteOauthCache("cap-0")
	svc.SetOauthCache("cap-after-delete", &OauthCacheItem{}, 0)
	if svc.GetOauthCache("cap-after-delete") == nil {
		t.Fatal("new key should be accepted after a slot was freed")
	}
	if got := atomic.LoadInt64(&oauthCacheCount); got > maxOauthCacheEntries {
		t.Fatalf("tracked cache size = %d, must not exceed %d", got, maxOauthCacheEntries)
	}
}

func TestOauthCacheDeleteDecrementsCount(t *testing.T) {
	clearOauthCacheForTest(t)
	svc := &OauthService{}

	svc.SetOauthCache("del-1", &OauthCacheItem{}, 0)
	svc.SetOauthCache("del-2", &OauthCacheItem{}, 0)
	// Overwriting an existing key must not increase the tracked count.
	svc.SetOauthCache("del-2", &OauthCacheItem{}, 0)

	if got := atomic.LoadInt64(&oauthCacheCount); got != 2 {
		t.Fatalf("tracked cache size = %d, want 2", got)
	}

	svc.DeleteOauthCache("del-1")
	if got := atomic.LoadInt64(&oauthCacheCount); got != 1 {
		t.Fatalf("tracked cache size after delete = %d, want 1", got)
	}
	if got := oauthCacheLen(); got != 1 {
		t.Fatalf("cache size after delete = %d, want 1", got)
	}

	// Deleting a missing key must not underflow the counter.
	svc.DeleteOauthCache("del-1")
	if got := atomic.LoadInt64(&oauthCacheCount); got != 1 {
		t.Fatalf("tracked cache size after deleting a missing key = %d, want 1", got)
	}
}

func TestValidateOidcAuthParams(t *testing.T) {
	maxField := strings.Repeat("a", maxOauthFieldLen)
	maxOp := strings.Repeat("a", maxOauthOpLen)

	if err := ValidateOidcAuthParams(maxField, maxField, maxOp, maxField, maxField, maxField); err != nil {
		t.Fatalf("values at the size limit should pass, got %v", err)
	}

	longField := maxField + "a"
	if err := ValidateOidcAuthParams(longField, "", OauthActionTypeLogin, "", "", ""); err == nil {
		t.Fatal("overlong id should be rejected")
	}
	for _, tc := range []struct{ name, id, uuid, op, devName, devOs, devType string }{
		{"uuid", "", longField, OauthActionTypeLogin, "", "", ""},
		{"device name", "", "", OauthActionTypeLogin, longField, "", ""},
		{"device os", "", "", OauthActionTypeLogin, "", longField, ""},
		{"device type", "", "", OauthActionTypeLogin, "", "", longField},
		{"op", "", "", maxOp + "a", "", "", ""},
	} {
		if err := ValidateOidcAuthParams(tc.id, tc.uuid, tc.op, tc.devName, tc.devOs, tc.devType); err == nil {
			t.Errorf("overlong %s should be rejected", tc.name)
		}
	}
}

func TestConfiguredProxyHonorsEnableFlag(t *testing.T) {
	for _, key := range []string{"SOCKS5_PROXY", "socks5_proxy", "SOCKS_PROXY", "socks_proxy",
		"ALL_PROXY", "all_proxy", "HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy",
		"RUSTDESK_API_PROXY_HOST", "PROXY_URL", "PROXY_HOST"} {
		t.Setenv(key, "")
	}
	previous := Config
	t.Cleanup(func() { Config = previous })

	Config = &config.Config{Proxy: config.Proxy{Enable: false, Host: "http://127.0.0.1:1080"}}
	if u, err := GetConfiguredProxyURL(); err != nil || u != nil {
		t.Fatalf("disabled proxy must be ignored, got url=%v err=%v", u, err)
	}

	Config.Proxy.Enable = true
	u, err := GetConfiguredProxyURL()
	if err != nil || u == nil || u.Host != "127.0.0.1:1080" {
		t.Fatalf("enabled proxy should be used, got url=%v err=%v", u, err)
	}
}

func TestInvalidProxyErrorRedactsCredentials(t *testing.T) {
	for _, key := range []string{"SOCKS5_PROXY", "socks5_proxy", "SOCKS_PROXY", "socks_proxy",
		"ALL_PROXY", "all_proxy", "HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy",
		"RUSTDESK_API_PROXY_HOST", "PROXY_URL", "PROXY_HOST"} {
		t.Setenv(key, "")
	}
	previousConfig, previousLogger := Config, Logger
	t.Cleanup(func() {
		Config = previousConfig
		Logger = previousLogger
	})

	Config = &config.Config{Proxy: config.Proxy{
		Enable: true,
		Host:   "socks5://demo:DUMMY-PASSWORD@127.0.0.1:bad",
	}}
	var output strings.Builder
	Logger = logrus.New()
	Logger.SetOutput(&output)

	_, err := GetConfiguredProxyURL()
	if err == nil {
		t.Fatal("malformed proxy URL should fail")
	}
	if strings.Contains(err.Error(), "DUMMY-PASSWORD") || strings.Contains(err.Error(), "demo:") {
		t.Fatalf("error leaks proxy credentials: %v", err)
	}

	_ = getHTTPClientWithProxy()
	if strings.Contains(output.String(), "DUMMY-PASSWORD") || strings.Contains(output.String(), "demo:") {
		t.Fatalf("log leaks proxy credentials: %q", output.String())
	}
}
