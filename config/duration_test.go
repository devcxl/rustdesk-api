package config_test

import (
	"os"
	"testing"
	"time"

	"github.com/lejianwen/rustdesk-api/v2/config"
)

func TestTokenExpireWithoutUnit(t *testing.T) {
	// 测试纯数字字符串 "168"
	os.Setenv("RUSTDESK_API_APP_TOKEN_EXPIRE", "168")
	cfg1 := &config.Config{}
	_ = config.Init(cfg1, "../conf/config.yaml")
	if cfg1.App.TokenExpire != 168*time.Hour {
		t.Fatalf("expected 168h, got %v", cfg1.App.TokenExpire)
	}

	// 测试标准带单位字符串 "72h"
	os.Setenv("RUSTDESK_API_APP_TOKEN_EXPIRE", "72h")
	cfg2 := &config.Config{}
	_ = config.Init(cfg2, "../conf/config.yaml")
	if cfg2.App.TokenExpire != 72*time.Hour {
		t.Fatalf("expected 72h, got %v", cfg2.App.TokenExpire)
	}

	// 测试带空格字符串 " 24 "
	os.Setenv("RUSTDESK_API_APP_TOKEN_EXPIRE", " 24 ")
	cfg3 := &config.Config{}
	_ = config.Init(cfg3, "../conf/config.yaml")
	if cfg3.App.TokenExpire != 24*time.Hour {
		t.Fatalf("expected 24h, got %v", cfg3.App.TokenExpire)
	}

	os.Unsetenv("RUSTDESK_API_APP_TOKEN_EXPIRE")
}
