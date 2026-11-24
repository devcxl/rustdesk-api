package router_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	apiController "github.com/lejianwen/rustdesk-api/v2/http/controller/api"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
)

// TestWebadminAuthQueryRequiresBrowserBinding verifies that a webadmin OAuth
// state bound to a browser cookie cannot be redeemed by a client that lacks it.
func TestWebadminAuthQueryRequiresBrowserBinding(t *testing.T) {
	g, db := setupSecurityEngine(t)
	user := createSecurityUser(t, db, "binding-owner")

	const state = "webadmin-binding-state"
	seed := func() {
		service.AllService.OauthService.SetOauthCache(state, &service.OauthCacheItem{
			UserId:         user.Id,
			Op:             model.OauthTypeGithub,
			Action:         service.OauthActionTypeLogin,
			DeviceType:     "webadmin",
			BrowserBinding: "binding-secret",
		}, 300)
	}

	seed()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/oidc/auth-query?code="+state, nil)
	w := httptest.NewRecorder()
	g.ServeHTTP(w, req)
	if strings.Contains(w.Body.String(), `"token"`) {
		t.Fatalf("state without the browser binding must not mint a token: %s", w.Body.String())
	}
	if service.AllService.OauthService.GetOauthCache(state) != nil {
		t.Fatal("mismatched binding should consume the state")
	}

	seed()
	req = httptest.NewRequest(http.MethodGet, "/api/admin/oidc/auth-query?code="+state, nil)
	req.AddCookie(&http.Cookie{Name: apiController.AdminOAuthBindingCookie, Value: "binding-secret"})
	w = httptest.NewRecorder()
	g.ServeHTTP(w, req)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"token"`) {
		t.Fatalf("matching browser binding should mint a token, got %d: %s", w.Code, w.Body.String())
	}
}

// TestAdminOidcAuthSetsBrowserBinding verifies the admin login initiation
// stores a browser binding cookie and binds the cached state to it.
func TestAdminOidcAuthSetsBrowserBinding(t *testing.T) {
	g, db := setupSecurityEngine(t)
	if err := db.AutoMigrate(&model.Oauth{}); err != nil {
		t.Fatal(err)
	}
	autoRegister := true
	if err := db.Create(&model.Oauth{
		Op:           model.OauthTypeGithub,
		OauthType:    model.OauthTypeGithub,
		ClientId:     "dummy-client",
		ClientSecret: "dummy-secret",
		AutoRegister: &autoRegister,
	}).Error; err != nil {
		t.Fatal(err)
	}

	w := performSecurityRequest(g, http.MethodPost, "/api/admin/oidc/auth",
		[]byte(`{"op":"github"}`), nil)
	if w.Code != http.StatusOK {
		t.Fatalf("admin oidc auth: %d %s", w.Code, w.Body.String())
	}
	cookie := w.Header().Get("Set-Cookie")
	if !strings.Contains(cookie, apiController.AdminOAuthBindingCookie+"=") {
		t.Fatalf("binding cookie missing: %q", cookie)
	}
	state := jsonField(t, w.Body.Bytes(), "code")
	if state == "" {
		t.Fatalf("state missing: %s", w.Body.String())
	}
	item := service.AllService.OauthService.GetOauthCache(state)
	if item == nil || item.BrowserBinding == "" {
		t.Fatalf("cached state is not browser-bound: %+v", item)
	}
	service.AllService.OauthService.DeleteOauthCache(state)
}

func jsonField(t *testing.T, body []byte, field string) string {
	t.Helper()
	var envelope struct {
		Data map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if value, ok := envelope.Data[field].(string); ok {
		return value
	}
	return ""
}
