package router_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
	"gorm.io/gorm"
)

type bindConfirmResult struct {
	Code int `json:"code"`
}

func postBindConfirm(t *testing.T, g http.Handler, token, code string) bindConfirmResult {
	t.Helper()
	body, err := json.Marshal(map[string]string{"code": code})
	if err != nil {
		t.Fatalf("marshal bindConfirm body: %v", err)
	}
	w := performSecurityRequest(g, http.MethodPost, "/api/admin/oauth/bindConfirm", body, map[string]string{
		"api-token": token,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("bindConfirm: expected HTTP 200, got %d: %s", w.Code, w.Body.String())
	}
	var res bindConfirmResult
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("decode bindConfirm response %q: %v", w.Body.String(), err)
	}
	return res
}

func countUserThirds(t *testing.T, db *gorm.DB, where string, args ...interface{}) int64 {
	t.Helper()
	var count int64
	if err := db.Model(&model.UserThird{}).Where(where, args...).Count(&count).Error; err != nil {
		t.Fatalf("count user_thirds: %v", err)
	}
	return count
}

func seedBindCache(t *testing.T, svc *service.OauthService, code string, item *service.OauthCacheItem) {
	t.Helper()
	svc.SetOauthCache(code, item, 0)
	t.Cleanup(func() { svc.DeleteOauthCache(code) })
}

// TestBindConfirmRejectsUntrustedCache 验证只有当前用户发起、处于 bind 动作、
// 且携带 OpenId 的缓存才能完成绑定；其余情况必须失败且不写入 user_thirds。
func TestBindConfirmRejectsUntrustedCache(t *testing.T) {
	g, db := setupSecurityEngine(t)
	if err := db.AutoMigrate(&model.UserThird{}); err != nil {
		t.Fatalf("auto migrate user_thirds: %v", err)
	}
	oauthSvc := service.AllService.OauthService

	owner := createSecurityUser(t, db, "bind-owner")
	other := createSecurityUser(t, db, "bind-other")
	const token = "bind-confirm-owner-token"
	createSecurityToken(t, db, &model.UserToken{UserId: owner.Id, Token: token, DeviceId: "webadmin"})

	cases := []struct {
		name string
		code string
		item *service.OauthCacheItem
	}{
		{"missing cache", "bind-missing", nil},
		{"login action", "bind-login-action", &service.OauthCacheItem{
			Action: service.OauthActionTypeLogin,
			UserId: owner.Id,
			OpenId: "openid-login-action",
			Op:     model.OauthTypeGithub,
		}},
		{"foreign user", "bind-foreign-user", &service.OauthCacheItem{
			Action: service.OauthActionTypeBind,
			UserId: other.Id,
			OpenId: "openid-foreign-user",
			Op:     model.OauthTypeGithub,
		}},
		{"empty openid", "bind-empty-openid", &service.OauthCacheItem{
			Action: service.OauthActionTypeBind,
			UserId: owner.Id,
			Op:     model.OauthTypeGithub,
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.item != nil {
				seedBindCache(t, oauthSvc, tc.code, tc.item)
			}
			res := postBindConfirm(t, g, token, tc.code)
			if res.Code == 0 {
				t.Fatalf("%s should be rejected, response code = 0", tc.name)
			}
			if got := countUserThirds(t, db, "user_id = ?", owner.Id); got != 0 {
				t.Fatalf("%s must not write a binding, %d row(s) found", tc.name, got)
			}
		})
	}
}

// TestBindConfirmRejectsDuplicateOpenId 验证同一 provider/openid 已存在绑定时，
// 其他用户不能再次绑定，即使 op 使用了大小写变体。
func TestBindConfirmRejectsDuplicateOpenId(t *testing.T) {
	g, db := setupSecurityEngine(t)
	if err := db.AutoMigrate(&model.UserThird{}); err != nil {
		t.Fatalf("auto migrate user_thirds: %v", err)
	}
	oauthSvc := service.AllService.OauthService

	owner := createSecurityUser(t, db, "bind-dup-owner")
	other := createSecurityUser(t, db, "bind-dup-other")
	const token = "bind-dup-owner-token"
	createSecurityToken(t, db, &model.UserToken{UserId: owner.Id, Token: token, DeviceId: "webadmin"})

	const openId = "openid-already-bound"
	existing := &model.UserThird{
		UserId: other.Id,
		OauthUser: model.OauthUser{
			OpenId: openId,
			Email:  "bound@example.com",
		},
		OauthType: model.OauthTypeGithub,
		Op:        model.OauthTypeGithub,
	}
	if err := db.Create(existing).Error; err != nil {
		t.Fatalf("seed user_thirds: %v", err)
	}

	const code = "bind-duplicate-openid"
	seedBindCache(t, oauthSvc, code, &service.OauthCacheItem{
		Action: service.OauthActionTypeBind,
		UserId: owner.Id,
		OpenId: openId,
		Op:     "GITHUB",
	})

	res := postBindConfirm(t, g, token, code)
	if res.Code == 0 {
		t.Fatal("duplicate openid should be rejected")
	}
	if got := countUserThirds(t, db, "open_id = ?", openId); got != 1 {
		t.Fatalf("duplicate openid must not add a row, %d row(s) found", got)
	}
	if got := countUserThirds(t, db, "user_id = ?", owner.Id); got != 0 {
		t.Fatalf("owner must not gain a binding, %d row(s) found", got)
	}
}

// TestBindConfirmBindsOwnedCache 验证合法缓存仍能完成绑定，并落库为归一化后的 op。
func TestBindConfirmBindsOwnedCache(t *testing.T) {
	g, db := setupSecurityEngine(t)
	if err := db.AutoMigrate(&model.UserThird{}); err != nil {
		t.Fatalf("auto migrate user_thirds: %v", err)
	}
	oauthSvc := service.AllService.OauthService

	owner := createSecurityUser(t, db, "bind-ok-owner")
	const token = "bind-ok-owner-token"
	createSecurityToken(t, db, &model.UserToken{UserId: owner.Id, Token: token, DeviceId: "webadmin"})

	const (
		code   = "bind-owned-cache"
		openId = "openid-owned"
	)
	seedBindCache(t, oauthSvc, code, &service.OauthCacheItem{
		Action: service.OauthActionTypeBind,
		UserId: owner.Id,
		OpenId: openId,
		Email:  "owner@example.com",
		Op:     "GITHUB",
	})

	res := postBindConfirm(t, g, token, code)
	if res.Code != 0 {
		t.Fatalf("valid bind cache should succeed, response code = %d", res.Code)
	}

	ut := oauthSvc.UserThirdInfo(model.OauthTypeGithub, openId)
	if ut.Id == 0 {
		t.Fatal("binding row should be created")
	}
	if ut.UserId != owner.Id {
		t.Fatalf("binding user_id = %d, want %d", ut.UserId, owner.Id)
	}
	if ut.Op != model.OauthTypeGithub || ut.OauthType != model.OauthTypeGithub {
		t.Fatalf("binding op/oauth_type = %q/%q, want %q", ut.Op, ut.OauthType, model.OauthTypeGithub)
	}
}
