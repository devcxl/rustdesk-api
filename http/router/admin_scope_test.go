package router_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"gorm.io/gorm"
)

const adminScopeRejectedCode = 101

type adminScopeResponse struct {
	Code int             `json:"code"`
	Data json.RawMessage `json:"data"`
}

// setupAdminScope 在隔离数据库中准备 Owner A 与遗留用户 B, 并返回 A 的鉴权头。
func setupAdminScope(t *testing.T) (*gin.Engine, *gorm.DB, *model.User, *model.User, map[string]string) {
	t.Helper()
	g, db := setupSecurityEngine(t)
	global.ApiInitValidator()
	if err := db.AutoMigrate(&model.AddressBook{}, &model.Tag{}); err != nil {
		t.Fatalf("auto migrate address book/tag: %v", err)
	}
	owner := createSecurityUser(t, db, "scope-owner")
	legacy := createSecurityUser(t, db, "scope-legacy")
	const token = "scope-owner-token"
	createSecurityToken(t, db, &model.UserToken{UserId: owner.Id, Token: token, DeviceId: "webadmin"})
	return g, db, owner, legacy, map[string]string{"api-token": token}
}

func adminScopeCode(t *testing.T, w *httptest.ResponseRecorder) int {
	t.Helper()
	if w.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d: %s", w.Code, w.Body.String())
	}
	resp := &adminScopeResponse{}
	if err := json.Unmarshal(w.Body.Bytes(), resp); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	return resp.Code
}

func adminScopeData(t *testing.T, w *httptest.ResponseRecorder) *adminScopeResponse {
	t.Helper()
	resp := &adminScopeResponse{}
	if err := json.Unmarshal(w.Body.Bytes(), resp); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	return resp
}

func adminScopeMustCreate(t *testing.T, db *gorm.DB, value interface{}) {
	t.Helper()
	if err := db.Create(value).Error; err != nil {
		t.Fatalf("create fixture: %v", err)
	}
}

func adminScopeMustCount(t *testing.T, db *gorm.DB, value interface{}, where string, args ...interface{}) int64 {
	t.Helper()
	var count int64
	if err := db.Model(value).Where(where, args...).Count(&count).Error; err != nil {
		t.Fatalf("count fixture: %v", err)
	}
	return count
}

func adminScopeBody(t *testing.T, value interface{}) []byte {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}
	return body
}

func adminScopeMustFindAddressBook(t *testing.T, db *gorm.DB, rowId uint) *model.AddressBook {
	t.Helper()
	ab := &model.AddressBook{}
	if err := db.Where("row_id = ?", rowId).First(ab).Error; err != nil {
		t.Fatalf("address book row %d should exist: %v", rowId, err)
	}
	return ab
}

func adminScopeMustFindTag(t *testing.T, db *gorm.DB, id uint) *model.Tag {
	t.Helper()
	tag := &model.Tag{}
	if err := db.Where("id = ?", id).First(tag).Error; err != nil {
		t.Fatalf("tag %d should exist: %v", id, err)
	}
	return tag
}

func adminScopeMustFindPeer(t *testing.T, db *gorm.DB, rowId uint) *model.Peer {
	t.Helper()
	peer := &model.Peer{}
	if err := db.Where("row_id = ?", rowId).First(peer).Error; err != nil {
		t.Fatalf("peer %d should exist: %v", rowId, err)
	}
	return peer
}

func adminScopeDataId(t *testing.T, w *httptest.ResponseRecorder, idField string) uint {
	t.Helper()
	resp := adminScopeData(t, w)
	if resp.Code != 0 {
		t.Fatalf("expected code 0, got %d: %s", resp.Code, w.Body.String())
	}
	payload := map[string]interface{}{}
	if err := json.Unmarshal(resp.Data, &payload); err != nil {
		t.Fatalf("decode response data %q: %v", string(resp.Data), err)
	}
	value, ok := payload[idField].(float64)
	if !ok {
		t.Fatalf("response data has no numeric %q: %s", idField, string(resp.Data))
	}
	return uint(value)
}

// TestAdminAddressBookOwnerScope 验证地址簿的详情/编辑/删除/批量创建只作用于当前 Owner 的行。
func TestAdminAddressBookOwnerScope(t *testing.T) {
	g, db, owner, legacy, auth := setupAdminScope(t)

	legacyRow := &model.AddressBook{Id: "legacy-device", Hostname: "legacy-host", UserId: legacy.Id}
	adminScopeMustCreate(t, db, legacyRow)
	ownRow := &model.AddressBook{Id: "owner-device", Hostname: "owner-host", UserId: owner.Id}
	adminScopeMustCreate(t, db, ownRow)

	// 非 Owner 行不可读取
	w := performSecurityRequest(g, http.MethodGet, fmt.Sprintf("/api/admin/address_book/detail/%d", legacyRow.RowId), nil, auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("detail of legacy row: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}

	// Owner 自己的行仍可读取
	w = performSecurityRequest(g, http.MethodGet, fmt.Sprintf("/api/admin/address_book/detail/%d", ownRow.RowId), nil, auth)
	if gotRowId := adminScopeDataId(t, w, "row_id"); gotRowId != ownRow.RowId {
		t.Fatalf("detail returned row %d, want %d", gotRowId, ownRow.RowId)
	}

	// 非 Owner 行不可编辑
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/update", adminScopeBody(t, map[string]interface{}{
		"row_id":   legacyRow.RowId,
		"id":       legacyRow.Id,
		"hostname": "hijacked-host",
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("update of legacy row: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if stored := adminScopeMustFindAddressBook(t, db, legacyRow.RowId); stored.Hostname != "legacy-host" {
		t.Fatalf("legacy row was modified: hostname = %q", stored.Hostname)
	}

	// 非 Owner 行不可删除
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/delete", adminScopeBody(t, map[string]interface{}{
		"row_id": legacyRow.RowId,
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("delete of legacy row: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.AddressBook{}, "row_id = ?", legacyRow.RowId); count != 1 {
		t.Fatalf("legacy row should survive delete, %d row(s) left", count)
	}

	// 创建时拒绝把归属写到其他用户
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/create", adminScopeBody(t, map[string]interface{}{
		"id":      "foreign-create",
		"user_id": legacy.Id,
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("create with foreign user_id: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.AddressBook{}, "id = ?", "foreign-create"); count != 0 {
		t.Fatalf("create with foreign user_id must not insert, %d row(s) found", count)
	}

	// 批量创建同样拒绝非 Owner 的 user_ids
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/batchCreate", adminScopeBody(t, map[string]interface{}{
		"id":       "foreign-batch",
		"user_ids": []uint{legacy.Id},
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("batch create with foreign user_ids: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.AddressBook{}, "id = ?", "foreign-batch"); count != 0 {
		t.Fatalf("batch create with foreign user_ids must not insert, %d row(s) found", count)
	}

	// 批量创建同样拒绝非 Owner 的 user_id
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/batchCreate", adminScopeBody(t, map[string]interface{}{
		"id":      "foreign-batch-user",
		"user_id": legacy.Id,
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("batch create with foreign user_id: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.AddressBook{}, "id = ?", "foreign-batch-user"); count != 0 {
		t.Fatalf("batch create with foreign user_id must not insert, %d row(s) found", count)
	}

	// 从设备批量导入时, 非 Owner 的设备不可导入
	legacyPeer := &model.Peer{Id: "legacy-peer", Uuid: "legacy-peer-uuid", UserId: legacy.Id}
	adminScopeMustCreate(t, db, legacyPeer)
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/batchCreateFromPeers", adminScopeBody(t, map[string]interface{}{
		"peer_ids": []uint{legacyPeer.RowId},
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("import legacy peer: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.AddressBook{}, "id = ?", legacyPeer.Id); count != 0 {
		t.Fatalf("legacy peer must not be imported, %d row(s) found", count)
	}

	ownPeer := &model.Peer{Id: "owner-peer", Uuid: "owner-peer-uuid", UserId: owner.Id}
	adminScopeMustCreate(t, db, ownPeer)
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/batchCreateFromPeers", adminScopeBody(t, map[string]interface{}{
		"peer_ids": []uint{ownPeer.RowId},
	}), auth)
	if code := adminScopeCode(t, w); code != 0 {
		t.Fatalf("import own peer: expected code 0, got %d: %s", code, w.Body.String())
	}
	imported := &model.AddressBook{}
	if err := db.Where("id = ?", ownPeer.Id).First(imported).Error; err != nil {
		t.Fatalf("own peer should be imported: %v", err)
	}
	if imported.UserId != owner.Id {
		t.Fatalf("imported row belongs to %d, want %d", imported.UserId, owner.Id)
	}

	// Owner 自己的行仍可编辑
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/update", adminScopeBody(t, map[string]interface{}{
		"row_id":   ownRow.RowId,
		"id":       ownRow.Id,
		"hostname": "owner-host-updated",
	}), auth)
	if code := adminScopeCode(t, w); code != 0 {
		t.Fatalf("update of own row: expected code 0, got %d: %s", code, w.Body.String())
	}
	if stored := adminScopeMustFindAddressBook(t, db, ownRow.RowId); stored.Hostname != "owner-host-updated" {
		t.Fatalf("own row update not persisted, hostname = %q", stored.Hostname)
	}

	// Owner 自己的行仍可删除
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/address_book/delete", adminScopeBody(t, map[string]interface{}{
		"row_id": ownRow.RowId,
	}), auth)
	if code := adminScopeCode(t, w); code != 0 {
		t.Fatalf("delete of own row: expected code 0, got %d: %s", code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.AddressBook{}, "row_id = ?", ownRow.RowId); count != 0 {
		t.Fatalf("own row should be deleted, %d row(s) left", count)
	}
}

// TestAdminTagOwnerScope 验证标签的详情/编辑/删除只作用于当前 Owner 的行。
func TestAdminTagOwnerScope(t *testing.T) {
	g, db, owner, legacy, auth := setupAdminScope(t)

	legacyTag := &model.Tag{Name: "legacy-tag", Color: 1, UserId: legacy.Id}
	adminScopeMustCreate(t, db, legacyTag)
	ownTag := &model.Tag{Name: "owner-tag", Color: 2, UserId: owner.Id}
	adminScopeMustCreate(t, db, ownTag)

	// 非 Owner 行不可读取
	w := performSecurityRequest(g, http.MethodGet, fmt.Sprintf("/api/admin/tag/detail/%d", legacyTag.Id), nil, auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("detail of legacy tag: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}

	// Owner 自己的行仍可读取
	w = performSecurityRequest(g, http.MethodGet, fmt.Sprintf("/api/admin/tag/detail/%d", ownTag.Id), nil, auth)
	if gotTagId := adminScopeDataId(t, w, "id"); gotTagId != ownTag.Id {
		t.Fatalf("detail returned tag %d, want %d", gotTagId, ownTag.Id)
	}

	// 非 Owner 行不可编辑
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/tag/update", adminScopeBody(t, map[string]interface{}{
		"id":    legacyTag.Id,
		"name":  "hijacked-tag",
		"color": 9,
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("update of legacy tag: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if stored := adminScopeMustFindTag(t, db, legacyTag.Id); stored.Name != "legacy-tag" {
		t.Fatalf("legacy tag was modified: name = %q", stored.Name)
	}

	// 非 Owner 行不可删除
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/tag/delete", adminScopeBody(t, map[string]interface{}{
		"id": legacyTag.Id,
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("delete of legacy tag: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.Tag{}, "id = ?", legacyTag.Id); count != 1 {
		t.Fatalf("legacy tag should survive delete, %d row(s) left", count)
	}

	// 创建时拒绝把归属写到其他用户
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/tag/create", adminScopeBody(t, map[string]interface{}{
		"name":    "foreign-tag",
		"color":   1,
		"user_id": legacy.Id,
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("create with foreign user_id: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.Tag{}, "name = ?", "foreign-tag"); count != 0 {
		t.Fatalf("create with foreign user_id must not insert, %d row(s) found", count)
	}

	// Owner 自己的行仍可编辑
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/tag/update", adminScopeBody(t, map[string]interface{}{
		"id":    ownTag.Id,
		"name":  "owner-tag-updated",
		"color": 3,
	}), auth)
	if code := adminScopeCode(t, w); code != 0 {
		t.Fatalf("update of own tag: expected code 0, got %d: %s", code, w.Body.String())
	}
	if stored := adminScopeMustFindTag(t, db, ownTag.Id); stored.Name != "owner-tag-updated" {
		t.Fatalf("own tag update not persisted, name = %q", stored.Name)
	}

	// Owner 自己的行仍可删除
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/tag/delete", adminScopeBody(t, map[string]interface{}{
		"id": ownTag.Id,
	}), auth)
	if code := adminScopeCode(t, w); code != 0 {
		t.Fatalf("delete of own tag: expected code 0, got %d: %s", code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.Tag{}, "id = ?", ownTag.Id); count != 0 {
		t.Fatalf("own tag should be deleted, %d row(s) left", count)
	}
}

// TestAdminPeerOwnerScope 验证设备的详情/编辑/删除/批量删除只作用于当前 Owner 的行。
func TestAdminPeerOwnerScope(t *testing.T) {
	g, db, owner, legacy, auth := setupAdminScope(t)

	legacyPeer := &model.Peer{Id: "legacy-device", Uuid: "legacy-uuid", UserId: legacy.Id, Alias: "legacy"}
	adminScopeMustCreate(t, db, legacyPeer)
	ownPeer := &model.Peer{Id: "owner-device", Uuid: "owner-uuid", UserId: owner.Id, Alias: "owner"}
	adminScopeMustCreate(t, db, ownPeer)

	// 非 Owner 行不可读取
	w := performSecurityRequest(g, http.MethodGet, fmt.Sprintf("/api/admin/peer/detail/%d", legacyPeer.RowId), nil, auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("detail of legacy peer: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}

	// Owner 自己的行仍可读取
	w = performSecurityRequest(g, http.MethodGet, fmt.Sprintf("/api/admin/peer/detail/%d", ownPeer.RowId), nil, auth)
	if gotPeerId := adminScopeDataId(t, w, "row_id"); gotPeerId != ownPeer.RowId {
		t.Fatalf("detail returned peer %d, want %d", gotPeerId, ownPeer.RowId)
	}

	// Owner 自己的行仍可编辑
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/peer/update", adminScopeBody(t, map[string]interface{}{
		"row_id": ownPeer.RowId,
		"alias":  "owner-updated",
	}), auth)
	if code := adminScopeCode(t, w); code != 0 {
		t.Fatalf("update of own peer: expected code 0, got %d: %s", code, w.Body.String())
	}
	if stored := adminScopeMustFindPeer(t, db, ownPeer.RowId); stored.Alias != "owner-updated" {
		t.Fatalf("own peer update not persisted, alias = %q", stored.Alias)
	}

	// 非 Owner 行不可编辑
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/peer/update", adminScopeBody(t, map[string]interface{}{
		"row_id": legacyPeer.RowId,
		"alias":  "hijacked",
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("update of legacy peer: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if stored := adminScopeMustFindPeer(t, db, legacyPeer.RowId); stored.Alias != "legacy" {
		t.Fatalf("legacy peer was modified: alias = %q", stored.Alias)
	}

	// 非 Owner 行不可删除
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/peer/delete", adminScopeBody(t, map[string]interface{}{
		"row_id": legacyPeer.RowId,
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("delete of legacy peer: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.Peer{}, "row_id = ?", legacyPeer.RowId); count != 1 {
		t.Fatalf("legacy peer should survive delete, %d row(s) left", count)
	}

	// 批量删除包含非 Owner 行时整批拒绝
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/peer/batchDelete", adminScopeBody(t, map[string]interface{}{
		"row_ids": []uint{ownPeer.RowId, legacyPeer.RowId},
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("batch delete with legacy peer: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.Peer{}, "row_id in ?", []uint{ownPeer.RowId, legacyPeer.RowId}); count != 2 {
		t.Fatalf("rejected batch delete must not remove rows, %d row(s) left", count)
	}

	// 只删除非 Owner 行同样被拒绝
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/peer/batchDelete", adminScopeBody(t, map[string]interface{}{
		"row_ids": []uint{legacyPeer.RowId},
	}), auth)
	if code := adminScopeCode(t, w); code != adminScopeRejectedCode {
		t.Fatalf("batch delete of legacy peer: expected code %d, got %d: %s", adminScopeRejectedCode, code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.Peer{}, "row_id = ?", legacyPeer.RowId); count != 1 {
		t.Fatalf("legacy peer should survive batch delete, %d row(s) left", count)
	}

	// Owner 自己的行仍可批量删除
	w = performSecurityRequest(g, http.MethodPost, "/api/admin/peer/batchDelete", adminScopeBody(t, map[string]interface{}{
		"row_ids": []uint{ownPeer.RowId},
	}), auth)
	if code := adminScopeCode(t, w); code != 0 {
		t.Fatalf("batch delete of own peer: expected code 0, got %d: %s", code, w.Body.String())
	}
	if count := adminScopeMustCount(t, db, &model.Peer{}, "row_id = ?", ownPeer.RowId); count != 0 {
		t.Fatalf("own peer should be deleted, %d row(s) left", count)
	}
	if count := adminScopeMustCount(t, db, &model.Peer{}, "row_id = ?", legacyPeer.RowId); count != 1 {
		t.Fatalf("legacy peer must remain after own batch delete, %d row(s) left", count)
	}
}
