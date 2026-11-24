package router_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/router"
	"github.com/lejianwen/rustdesk-api/v2/lib/jwt"
	"github.com/lejianwen/rustdesk-api/v2/lib/lock"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
	log "github.com/sirupsen/logrus"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// setupSecurityEngine 构建真实的 router, 使用内存 SQLite 隔离每个测试的数据。
func setupSecurityEngine(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	if _, err := os.Stat("resources/templates"); os.IsNotExist(err) {
		if err := os.Chdir("../.."); err != nil {
			t.Fatalf("chdir to repo root: %v", err)
		}
	}
	gin.SetMode(gin.TestMode)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared",
		strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		t.Fatalf("open in-memory sqlite: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })

	if err := db.AutoMigrate(&model.User{}, &model.UserToken{}, &model.Peer{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	global.Config.App.ShowSwagger = 0
	global.Config.Gin.ResourcesPath = "./resources"
	global.Logger = log.New()
	global.Logger.SetOutput(io.Discard)
	global.Jwt = jwt.NewJwt("", 0)
	global.InitI18n()

	service.New(&global.Config, db, global.Logger, global.Jwt, lock.NewLocal())

	g := gin.New()
	router.Init(g)
	router.ApiInit(g)
	return g, db
}

func createSecurityUser(t *testing.T, db *gorm.DB, username string) *model.User {
	t.Helper()
	isAdmin := true
	user := &model.User{
		Username: username,
		Status:   model.COMMON_STATUS_ENABLE,
		IsAdmin:  &isAdmin,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return user
}

func createSecurityToken(t *testing.T, db *gorm.DB, token *model.UserToken) {
	t.Helper()
	if token.ExpiredAt == 0 {
		token.ExpiredAt = time.Now().Add(time.Hour).Unix()
	}
	if err := db.Create(token).Error; err != nil {
		t.Fatalf("create user token: %v", err)
	}
}

func performSecurityRequest(g http.Handler, method, path string, body []byte, headers map[string]string) *httptest.ResponseRecorder {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	w := httptest.NewRecorder()
	g.ServeHTTP(w, req)
	return w
}

// adminRequestRejected 判断后台接口是否已经拒绝该 token。
// BackendUserAuth 对无效 token 的约定是 HTTP 200 + body code 403 (框架统一响应),
// 部分鉴权路径使用 HTTP 401; 两者都表示请求未被授权。
func adminRequestRejected(t *testing.T, w *httptest.ResponseRecorder) bool {
	t.Helper()
	if w.Code == http.StatusUnauthorized {
		return true
	}
	if w.Code != http.StatusOK {
		return false
	}
	resp := struct {
		Code int `json:"code"`
	}{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		return false
	}
	return resp.Code == http.StatusForbidden
}

func countSecurityTokens(t *testing.T, db *gorm.DB, where string, args ...interface{}) int64 {
	t.Helper()
	var count int64
	if err := db.Model(&model.UserToken{}).Where(where, args...).Count(&count).Error; err != nil {
		t.Fatalf("count tokens: %v", err)
	}
	return count
}

// TestSecurityFixAdminLogoutRevokesToken 验证 /api/admin/logout 在鉴权之后执行, 确实删除 token。
func TestSecurityFixAdminLogoutRevokesToken(t *testing.T) {
	g, db := setupSecurityEngine(t)

	user := createSecurityUser(t, db, "logout-user")
	const token = "logout-api-token"
	createSecurityToken(t, db, &model.UserToken{
		UserId:    user.Id,
		Token:     token,
		DeviceId:  "webadmin",
		ExpiredAt: time.Now().Add(time.Hour).Unix(),
	})

	authHeader := map[string]string{"api-token": token}
	w := performSecurityRequest(g, http.MethodGet, "/api/admin/user/current", nil, authHeader)
	if w.Code != http.StatusOK {
		t.Fatalf("current user before logout: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	w = performSecurityRequest(g, http.MethodPost, "/api/admin/logout", nil, authHeader)
	if w.Code != http.StatusOK {
		t.Fatalf("logout: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if count := countSecurityTokens(t, db, "token = ?", token); count != 0 {
		t.Fatalf("logout should revoke the token row, %d row(s) left", count)
	}

	w = performSecurityRequest(g, http.MethodGet, "/api/admin/user/current", nil, authHeader)
	if !adminRequestRejected(t, w) {
		t.Fatalf("current user after logout should be rejected, got %d: %s", w.Code, w.Body.String())
	}
}

// TestSecurityFixSysInfoUuidRewriteAndDeleteRevokesTokens
// 验证匿名 /api/sysinfo 不能改写已存在设备的 uuid, 且删除设备会撤销该设备的 token。
func TestSecurityFixSysInfoUuidRewriteAndDeleteRevokesTokens(t *testing.T) {
	g, db := setupSecurityEngine(t)

	user := createSecurityUser(t, db, "peer-owner")
	const (
		deviceId    = "device-id-2"
		storedUuid  = "uuid-U"
		clientToken = "client-token-2"
	)
	peer := &model.Peer{
		Id:       deviceId,
		Uuid:     storedUuid,
		UserId:   user.Id,
		Hostname: "original-host",
	}
	if err := db.Create(peer).Error; err != nil {
		t.Fatalf("create peer: %v", err)
	}
	createSecurityToken(t, db, &model.UserToken{
		UserId:     user.Id,
		Token:      clientToken,
		DeviceUuid: storedUuid,
		DeviceId:   deviceId,
	})

	body, err := json.Marshal(map[string]string{
		"id":       deviceId,
		"uuid":     "uuid-X",
		"hostname": "renamed-host",
	})
	if err != nil {
		t.Fatalf("marshal sysinfo body: %v", err)
	}
	w := performSecurityRequest(g, http.MethodPost, "/api/sysinfo", body, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("sysinfo: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	stored := service.AllService.PeerService.FindById(deviceId)
	if stored.RowId == 0 {
		t.Fatal("peer should still exist after sysinfo")
	}
	if stored.Uuid != storedUuid {
		t.Fatalf("anonymous sysinfo must not rewrite peer uuid: got %q, want %q", stored.Uuid, storedUuid)
	}
	if stored.Hostname != "renamed-host" {
		t.Fatalf("sysinfo should still update other fields, hostname = %q", stored.Hostname)
	}

	if err := service.AllService.PeerService.Delete(stored); err != nil {
		t.Fatalf("delete peer: %v", err)
	}
	if count := countSecurityTokens(t, db, "token = ?", clientToken); count != 0 {
		t.Fatalf("deleting a peer should revoke its tokens, %d row(s) left", count)
	}

	w = performSecurityRequest(g, http.MethodGet, "/api/user/info", nil, map[string]string{
		"Authorization": "Bearer " + clientToken,
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("client info after peer delete: expected 401, got %d: %s", w.Code, w.Body.String())
	}

	w = performSecurityRequest(g, http.MethodGet, "/api/admin/user/current", nil, map[string]string{
		"api-token": clientToken,
	})
	if !adminRequestRejected(t, w) {
		t.Fatalf("admin current after peer delete should be rejected, got %d: %s", w.Code, w.Body.String())
	}
}

// TestSecurityFixEmptyUuidTokenSurvival 验证按设备删除时不会用空 uuid 误删后台 token。
func TestSecurityFixEmptyUuidTokenSurvival(t *testing.T) {
	_, db := setupSecurityEngine(t)

	user := createSecurityUser(t, db, "webadmin-user")
	const webadminToken = "webadmin-token-3"
	createSecurityToken(t, db, &model.UserToken{
		UserId:     user.Id,
		Token:      webadminToken,
		DeviceUuid: "",
		DeviceId:   "",
	})

	peer := &model.Peer{
		Id:     "peer-without-uuid",
		Uuid:   "",
		UserId: user.Id,
	}
	if err := db.Create(peer).Error; err != nil {
		t.Fatalf("create peer: %v", err)
	}

	if err := service.AllService.PeerService.Delete(peer); err != nil {
		t.Fatalf("delete peer without uuid: %v", err)
	}
	if count := countSecurityTokens(t, db, "token = ?", webadminToken); count != 1 {
		t.Fatalf("empty-uuid peer deletion must not remove webadmin tokens, %d row(s) left", count)
	}

	if err := service.AllService.UserService.FlushTokenByUuidAndDeviceId("", ""); err != nil {
		t.Fatalf("empty identity flush should be a no-op: %v", err)
	}
	if count := countSecurityTokens(t, db, "token = ?", webadminToken); count != 1 {
		t.Fatalf("flush with empty uuid/device id must be a no-op, %d row(s) left", count)
	}
}
