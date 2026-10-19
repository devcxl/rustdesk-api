package service

import (
	"os"
	"testing"
)

func TestGetConfiguredProxyURL(t *testing.T) {
	// 测试自动补全 socks5://
	os.Setenv("SOCKS5_PROXY", "192.168.1.100:1080")
	defer os.Unsetenv("SOCKS5_PROXY")

	u, err := GetConfiguredProxyURL()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if u == nil {
		t.Fatal("expected non-nil proxy url")
	}
	if u.Scheme != "socks5" || u.Host != "192.168.1.100:1080" {
		t.Fatalf("expected socks5://192.168.1.100:1080, got %s", u.String())
	}

	// 测试 ALL_PROXY
	os.Unsetenv("SOCKS5_PROXY")
	os.Setenv("ALL_PROXY", "socks5://10.0.0.1:10808")
	defer os.Unsetenv("ALL_PROXY")

	u2, err2 := GetConfiguredProxyURL()
	if err2 != nil || u2 == nil {
		t.Fatalf("unexpected error: %v", err2)
	}
	if u2.String() != "socks5://10.0.0.1:10808" {
		t.Fatalf("expected socks5://10.0.0.1:10808, got %s", u2.String())
	}

	// 测试 HTTP_PROXY
	os.Unsetenv("ALL_PROXY")
	os.Setenv("HTTP_PROXY", "http://127.0.0.1:7890")
	defer os.Unsetenv("HTTP_PROXY")

	u3, err3 := GetConfiguredProxyURL()
	if err3 != nil || u3 == nil {
		t.Fatalf("unexpected error: %v", err3)
	}
	if u3.String() != "http://127.0.0.1:7890" {
		t.Fatalf("expected http://127.0.0.1:7890, got %s", u3.String())
	}

	// 测试无代理
	os.Unsetenv("HTTP_PROXY")
	u4, err4 := GetConfiguredProxyURL()
	if err4 != nil {
		t.Fatalf("unexpected error: %v", err4)
	}
	if u4 != nil {
		t.Fatalf("expected nil proxy url, got %s", u4.String())
	}
}
