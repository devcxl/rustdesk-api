package service

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/lejianwen/rustdesk-api/v2/config"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// setupSessionSecurityDB 用独立的内存 SQLite 替换包级 DB/Config, 测试结束后恢复。
func setupSessionSecurityDB(t *testing.T) *gorm.DB {
	t.Helper()
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
	if err := db.AutoMigrate(&model.User{}, &model.UserToken{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB, previousConfig := DB, Config
	DB = db
	t.Cleanup(func() {
		DB, Config = previousDB, previousConfig
		_ = sqlDB.Close()
	})
	return db
}

func createSessionUser(t *testing.T, db *gorm.DB, username string, status model.StatusCode) *model.User {
	t.Helper()
	user := &model.User{Username: username, Status: status}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return user
}

func createSessionToken(t *testing.T, db *gorm.DB, userID uint, token string) *model.UserToken {
	t.Helper()
	ut := &model.UserToken{
		UserId:    userID,
		Token:     token,
		ExpiredAt: time.Now().Add(time.Hour).Unix(),
	}
	if err := db.Create(ut).Error; err != nil {
		t.Fatalf("create user token: %v", err)
	}
	return ut
}

// ageSessionToken 只回拨 created_at, 保留滑动过期时间不变。
func ageSessionToken(t *testing.T, db *gorm.DB, id uint, age time.Duration) {
	t.Helper()
	if err := db.Model(&model.UserToken{}).Where("id = ?", id).
		UpdateColumn("created_at", time.Now().Add(-age)).Error; err != nil {
		t.Fatalf("age user token: %v", err)
	}
}

func TestInfoByAccessTokenRejectsTokenBeyondMaxLifetime(t *testing.T) {
	db := setupSessionSecurityDB(t)
	Config = &config.Config{App: config.App{TokenMaxLifetime: 48 * time.Hour}}
	svc := &UserService{}
	if got := svc.TokenMaxLifetime(); got != 48*time.Hour {
		t.Fatalf("TokenMaxLifetime() = %v, want configured 48h", got)
	}

	user := createSessionUser(t, db, "absolute-life", model.COMMON_STATUS_ENABLE)
	ut := createSessionToken(t, db, user.Id, "absolute-life-token")

	gotUser, gotToken := svc.InfoByAccessToken(ut.Token)
	if gotUser.Id != user.Id || gotToken.Id != ut.Id {
		t.Fatalf("fresh token should authenticate, got user=%d token=%d", gotUser.Id, gotToken.Id)
	}

	// 超过绝对寿命, 但滑动的 expired_at 仍在未来。
	ageSessionToken(t, db, ut.Id, 49*time.Hour)
	svc.RefreshAccessToken(ut)

	gotUser, gotToken = svc.InfoByAccessToken(ut.Token)
	if gotUser.Id != 0 {
		t.Fatalf("token older than max lifetime must be rejected, got user %d", gotUser.Id)
	}
	if gotToken.Id != 0 {
		t.Fatalf("rejected token must be zero value, got token %d", gotToken.Id)
	}
	if ut.ExpiredAt <= time.Now().Unix() {
		t.Fatalf("refresh should have extended expired_at, got %d", ut.ExpiredAt)
	}
}

func TestInfoByAccessTokenDefaultLifetimeFallback(t *testing.T) {
	db := setupSessionSecurityDB(t)
	// 0 表示使用默认 30 天, 而不是不限制。
	Config = &config.Config{}
	svc := &UserService{}
	if got := svc.TokenMaxLifetime(); got != defaultTokenMaxLifetime {
		t.Fatalf("TokenMaxLifetime() = %v, want default %v", got, defaultTokenMaxLifetime)
	}

	user := createSessionUser(t, db, "default-life", model.COMMON_STATUS_ENABLE)

	recent := createSessionToken(t, db, user.Id, "recent-token")
	ageSessionToken(t, db, recent.Id, 29*24*time.Hour)
	if gotUser, _ := svc.InfoByAccessToken(recent.Token); gotUser.Id != user.Id {
		t.Fatalf("token within the default lifetime should authenticate, got user %d", gotUser.Id)
	}

	expired := createSessionToken(t, db, user.Id, "expired-token")
	ageSessionToken(t, db, expired.Id, 31*24*time.Hour)
	if gotUser, gotToken := svc.InfoByAccessToken(expired.Token); gotUser.Id != 0 || gotToken.Id != 0 {
		t.Fatalf("token beyond the default lifetime must be rejected, got user=%d token=%d",
			gotUser.Id, gotToken.Id)
	}
}

func TestInfoByAccessTokenReturnsDisabledUserForMiddlewareRejection(t *testing.T) {
	db := setupSessionSecurityDB(t)
	Config = &config.Config{}
	svc := &UserService{}

	user := createSessionUser(t, db, "disabled-user", model.COMMON_STATUS_DISABLED)
	ut := createSessionToken(t, db, user.Id, "disabled-token")

	gotUser, gotToken := svc.InfoByAccessToken(ut.Token)
	if gotUser.Id != user.Id || gotToken.Id != ut.Id {
		t.Fatalf("disabled user token should still resolve, got user=%d token=%d", gotUser.Id, gotToken.Id)
	}
	if svc.CheckUserEnable(gotUser) {
		t.Fatal("disabled user must not be reported as enabled")
	}
}
