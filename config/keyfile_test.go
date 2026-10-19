package config_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lejianwen/rustdesk-api/v2/config"
)

func TestKeyFileEnv(t *testing.T) {
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "id_ed25519.pub")
	err := os.WriteFile(keyPath, []byte("test_public_key_base64=\r\n"), 0644)
	if err != nil {
		t.Fatal(err)
	}

	// 测试标准环境变量 RUSTDESK_API_RUSTDESK_KEY_FILE
	os.Setenv("RUSTDESK_API_RUSTDESK_KEY_FILE", keyPath)
	defer os.Unsetenv("RUSTDESK_API_RUSTDESK_KEY_FILE")

	cfg := &config.Config{}
	_ = config.Init(cfg, "../conf/config.yaml")

	if cfg.Rustdesk.Key != "test_public_key_base64=" {
		t.Fatalf("expected key 'test_public_key_base64=', got %q", cfg.Rustdesk.Key)
	}

	// 测试短环境变量 KEY_FILE
	os.Unsetenv("RUSTDESK_API_RUSTDESK_KEY_FILE")
	os.Setenv("KEY_FILE", keyPath)
	defer os.Unsetenv("KEY_FILE")

	cfg2 := &config.Config{}
	_ = config.Init(cfg2, "../conf/config.yaml")

	if cfg2.Rustdesk.Key != "test_public_key_base64=" {
		t.Fatalf("expected key 'test_public_key_base64=', got %q", cfg2.Rustdesk.Key)
	}
}
