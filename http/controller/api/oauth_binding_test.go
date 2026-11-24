package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetAdminOAuthBindingCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/admin/oidc/auth", nil)

	SetAdminOAuthBindingCookie(c, "binding-secret")

	raw := w.Header().Get("Set-Cookie")
	for _, want := range []string{
		AdminOAuthBindingCookie + "=binding-secret",
		"Path=/api",
		"Max-Age=300",
		"HttpOnly",
		"SameSite=Lax",
	} {
		if !strings.Contains(raw, want) {
			t.Fatalf("Set-Cookie = %q, missing %q", raw, want)
		}
	}
}

func TestBrowserBindingMatches(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/api/admin/oidc/auth-query", nil)

	if !browserBindingMatches(c, "") {
		t.Fatal("empty expected binding should always pass (desktop flow)")
	}
	if browserBindingMatches(c, "binding-secret") {
		t.Fatal("missing cookie must not match a bound state")
	}

	c.Request.AddCookie(&http.Cookie{Name: AdminOAuthBindingCookie, Value: "binding-secret"})
	if !browserBindingMatches(c, "binding-secret") {
		t.Fatal("matching cookie should pass")
	}
	if browserBindingMatches(c, "other-secret") {
		t.Fatal("different binding must not match")
	}
}
