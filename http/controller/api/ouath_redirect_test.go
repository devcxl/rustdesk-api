package api

import (
	"strings"
	"testing"
)

func TestWebadminCallbackRedirect(t *testing.T) {
	if got, want := webadminCallbackRedirect("abc123"), "/_admin/#/oauth/callback?state=abc123"; got != want {
		t.Fatalf("webadminCallbackRedirect() = %q, want %q", got, want)
	}

	got := webadminCallbackRedirect("a b/c")
	if !strings.HasPrefix(got, "/_admin/#/oauth/callback?state=") {
		t.Fatalf("redirect prefix changed: %q", got)
	}
	if !strings.Contains(got, "state=a+b%2Fc") {
		t.Fatalf("state must be query-escaped, got %q", got)
	}
}
