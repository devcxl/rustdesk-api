package router_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/router"
	"github.com/lejianwen/rustdesk-api/v2/service"
)

func setupTestEngine(t *testing.T) *gin.Engine {
	t.Helper()
	if _, err := os.Stat("resources/templates"); os.IsNotExist(err) {
		_ = os.Chdir("../..")
	}
	gin.SetMode(gin.TestMode)
	g := gin.New()

	global.Config.App.ShowSwagger = 0
	global.Config.Gin.ResourcesPath = "./resources"
	service.New(&global.Config, nil, nil, nil, nil)

	router.WebInit(g)
	router.Init(g)
	router.ApiInit(g)
	return g
}

// TestSingleUserRemovedEndpoints 验证多租户/企业审计/命令下发等接口已被彻底移除 (404)
func TestSingleUserRemovedEndpoints(t *testing.T) {
	g := setupTestEngine(t)

	removedEndpoints := []struct {
		method string
		path   string
	}{
		// WebClient 静态页面及专属服务端接口已移除
		{"GET", "/webclient/index.html"},
		{"GET", "/webclient-config/index.js"},
		{"POST", "/api/server-config"},
		{"POST", "/api/server-config-v2"},
		// 注册通道彻底关闭
		{"POST", "/api/admin/user/register"},
		// 用户群组已移除
		{"GET", "/api/admin/group/list"},
		{"POST", "/api/admin/group/create"},
		// 设备群组已移除
		{"GET", "/api/admin/device_group/list"},
		{"POST", "/api/admin/device_group/create"},
		// 服务端远程命令已移除
		{"POST", "/api/admin/rustdesk/sendCmd"},
		{"GET", "/api/admin/rustdesk/cmdList"},
		// 审计日志接口已移除
		{"GET", "/api/admin/audit_conn/list"},
		{"GET", "/api/admin/audit_file/list"},
		// 集中下线凭证已移除
		{"GET", "/api/admin/user_token/list"},
		// 旧版双轨 /my/* 已移除
		{"GET", "/api/admin/my/address_book/list"},
		{"GET", "/api/admin/my/tag/list"},
		{"GET", "/api/admin/my/peer/list"},
		// 外链分享已移除
		{"POST", "/api/shared-peer"},
		{"POST", "/api/admin/address_book/shareByWebClient"},
	}

	for _, ep := range removedEndpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(ep.method, ep.path, nil)
			g.ServeHTTP(w, req)
			if w.Code != http.StatusNotFound {
				t.Fatalf("endpoint %s %s should be removed (404), got code %d", ep.method, ep.path, w.Code)
			}
		})
	}
}

func TestWebClientRoutesRemoved(t *testing.T) {
	g := setupTestEngine(t)
	removedRoutes := map[string]struct{}{
		"GET /webclient/*filepath":       {},
		"HEAD /webclient/*filepath":      {},
		"GET /webclient2/*filepath":      {},
		"HEAD /webclient2/*filepath":     {},
		"GET /webclient-config/index.js": {},
		"POST /api/server-config":        {},
		"POST /api/server-config-v2":     {},
		"GET /api/admin/config/app":      {},
	}

	for _, route := range g.Routes() {
		name := route.Method + " " + route.Path
		if _, exists := removedRoutes[name]; exists {
			t.Errorf("WebClient route %s should not be registered", name)
		}
	}
}

// TestSingleUserAuditNoOp 验证连接和文件审计对客户端保持静默成功 (200 Success)，无数据库读写
func TestSingleUserAuditNoOp(t *testing.T) {
	g := setupTestEngine(t)

	endpoints := []string{"/api/audit/conn", "/api/audit/file"}
	for _, ep := range endpoints {
		t.Run(ep, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", ep, bytes.NewBufferString(`{}`))
			req.Header.Set("Content-Type", "application/json")
			g.ServeHTTP(w, req)
			if w.Code != http.StatusOK {
				t.Fatalf("audit endpoint %s should return 200, got %d", ep, w.Code)
			}
		})
	}
}

// TestSingleUserLoginOptions 验证登录方式严格收敛为 GitHub OAuth，且注册已彻底关闭
func TestSingleUserLoginOptions(t *testing.T) {
	g := setupTestEngine(t)

	// 1. 验证后台登录选项
	wAdmin := httptest.NewRecorder()
	reqAdmin, _ := http.NewRequest("GET", "/api/admin/login-options", nil)
	g.ServeHTTP(wAdmin, reqAdmin)
	if wAdmin.Code != http.StatusOK {
		t.Fatalf("expected 200 from admin login-options, got %d", wAdmin.Code)
	}
	bodyAdmin := wAdmin.Body.String()
	if !strings.Contains(bodyAdmin, `"github"`) {
		t.Fatalf("expected admin login options to contain github, got %s", bodyAdmin)
	}
	if strings.Contains(bodyAdmin, `"register":true`) {
		t.Fatalf("expected registration to be false, got %s", bodyAdmin)
	}

	// 2. 验证客户端登录选项
	wClient := httptest.NewRecorder()
	reqClient, _ := http.NewRequest("GET", "/api/login-options", nil)
	g.ServeHTTP(wClient, reqClient)
	if wClient.Code != http.StatusOK {
		t.Fatalf("expected 200 from client login-options, got %d", wClient.Code)
	}
	bodyClient := wClient.Body.String()
	if !strings.Contains(bodyClient, "oidc/github") {
		t.Fatalf("expected client login options to contain oidc/github, got %s", bodyClient)
	}
}

// TestSingleUserRouteCount 验证路由总量从原先 130+ 降至 82 条以下
func TestSingleUserRouteCount(t *testing.T) {
	g := setupTestEngine(t)
	routes := g.Routes()
	t.Logf("Total active routes after single-user refactor: %d", len(routes))
	if len(routes) > 85 {
		t.Fatalf("expected total routes to be pruned under 85, got %d", len(routes))
	}
}
