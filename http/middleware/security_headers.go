package middleware

import "github.com/gin-gonic/gin"

// SecurityHeaders applies baseline browser hardening to every response.
// frame-ancestors/X-Frame-Options prevent clickjacking of the admin console and
// OAuth result pages; nosniff blocks MIME confusion; the referrer policy avoids
// leaking full URLs (including OAuth state) to third-party resources.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.Writer.Header()
		header.Set("X-Content-Type-Options", "nosniff")
		header.Set("X-Frame-Options", "DENY")
		header.Set("Content-Security-Policy", "frame-ancestors 'none'")
		header.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	}
}
