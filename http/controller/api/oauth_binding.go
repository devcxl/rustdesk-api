package api

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AdminOAuthBindingCookie binds a webadmin OAuth state to the browser that
// initiated it. It is HttpOnly and short-lived; desktop client flows leave the
// binding empty and keep the state-only behavior documented in ADR-0001.
const AdminOAuthBindingCookie = "rustdesk_admin_oauth_binding"

// SetAdminOAuthBindingCookie stores the binding secret for the login flow.
func SetAdminOAuthBindingCookie(c *gin.Context, binding string) {
	if binding == "" {
		return
	}
	secure := c.Request.TLS != nil ||
		strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AdminOAuthBindingCookie, binding, 300, "/api", "", secure, true)
}

func adminOAuthBinding(c *gin.Context) string {
	value, _ := c.Cookie(AdminOAuthBindingCookie)
	return value
}

// browserBindingMatches reports whether the request carries the browser
// binding expected by the cached OAuth state. An empty expected value means the
// flow has no browser binding (desktop clients), so the check passes.
func browserBindingMatches(c *gin.Context, expected string) bool {
	if expected == "" {
		return true
	}
	return subtle.ConstantTimeCompare([]byte(adminOAuthBinding(c)), []byte(expected)) == 1
}
