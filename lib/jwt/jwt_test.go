package jwt

import (
	"strings"
	"testing"
	"time"
)

// testJWTSecret is a fixed HMAC secret used only by these tests.
// It is NOT a real key, is clearly marked as non-production, and must never
// be reused for deployment jwt.key values.
const testJWTSecret = "rustdesk-api-test-only-jwt-secret-not-for-production-0123456789"

// 测试token生成
func TestGenerateToken(t *testing.T) {
	jwtService := NewJwt(testJWTSecret, time.Second*1000)
	token := jwtService.GenerateToken(1)
	if token == "" {
		t.Fatal("token生成失败")
	}
	if strings.Count(token, ".") != 2 {
		t.Fatal("token格式不正确")
	}
}

// 测试token解析
func TestParseToken(t *testing.T) {
	jwtService := NewJwt(testJWTSecret, time.Second*1000)
	token := jwtService.GenerateToken(999)
	if token == "" {
		t.Fatal("token生成失败")
	}
	uid, err := jwtService.ParseToken(token)
	if err != nil {

		t.Fatal("token解析失败", err)
	}
	if uid != 999 {
		t.Fatal("token解析失败")
	}
}

// 测试过期token被拒绝
func TestParseTokenExpired(t *testing.T) {
	// 负过期时间生成一个已过期的token
	jwtService := NewJwt(testJWTSecret, -time.Minute)
	token := jwtService.GenerateToken(999)
	if token == "" {
		t.Fatal("token生成失败")
	}
	if _, err := jwtService.ParseToken(token); err == nil {
		t.Fatal("过期token解析应当失败")
	}
}

func BenchmarkJwtService_GenerateToken(b *testing.B) {
	jwtService := NewJwt(testJWTSecret, time.Second*1000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		jwtService.GenerateToken(999)
	}
}

func BenchmarkJwtService_ParseToken(b *testing.B) {
	jwtService := NewJwt(testJWTSecret, time.Second*1000)
	token := jwtService.GenerateToken(999)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = jwtService.ParseToken(token)
	}

}
