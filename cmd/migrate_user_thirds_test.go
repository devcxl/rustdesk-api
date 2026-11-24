package main

import (
	"fmt"
	"strings"
	"testing"

	"github.com/lejianwen/rustdesk-api/v2/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func newUserThirdsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared",
		strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		t.Fatalf("open in-memory sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.UserThird{}); err != nil {
		t.Fatalf("auto migrate user_thirds: %v", err)
	}
	return db
}

// dropUniqueIndexSimulatingLegacy removes the composite unique index so the
// test can insert legacy-shaped rows (op variants, duplicates, empty open_id).
func dropUniqueIndexSimulatingLegacy(t *testing.T, db *gorm.DB) {
	t.Helper()
	if !db.Migrator().HasIndex(&model.UserThird{}, userThirdsUniqueIndexName) {
		t.Fatalf("expected AutoMigrate to create %s", userThirdsUniqueIndexName)
	}
	if err := db.Migrator().DropIndex(&model.UserThird{}, userThirdsUniqueIndexName); err != nil {
		t.Fatalf("drop unique index: %v", err)
	}
	if db.Migrator().HasIndex(&model.UserThird{}, userThirdsUniqueIndexName) {
		t.Fatalf("unique index %s still present after drop", userThirdsUniqueIndexName)
	}
}

func createThird(t *testing.T, db *gorm.DB, op, openID string) model.UserThird {
	t.Helper()
	ut := model.UserThird{UserId: 1, Op: op}
	ut.OpenId = openID
	if err := db.Create(&ut).Error; err != nil {
		t.Fatalf("create user_third (op=%q open_id=%q): %v", op, openID, err)
	}
	return ut
}

func countThirdRows(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var count int64
	if err := db.Model(&model.UserThird{}).Count(&count).Error; err != nil {
		t.Fatalf("count user_thirds: %v", err)
	}
	return count
}

func TestNormalizeUserThirds(t *testing.T) {
	db := newUserThirdsTestDB(t)
	dropUniqueIndexSimulatingLegacy(t, db)

	// Legacy-shaped rows:
	// - op variants: github (kept), GITHUB (normalized), webauth (normalized), "" (normalized)
	// - duplicates: (github, 11) twice, and GITHUB/22 + github/22 which
	//   collide after normalization
	// - empty open_id: unauthenticatable, must be removed
	first := createThird(t, db, "github", "11")
	createThird(t, db, "GITHUB", "22")
	createThird(t, db, "webauth", "33")
	createThird(t, db, "", "44")
	createThird(t, db, "github", "")   // empty open_id -> removed
	createThird(t, db, "github", "11") // duplicate of first -> removed
	createThird(t, db, "github", "22") // duplicate of "GITHUB"/22 after normalization -> removed
	if got := countThirdRows(t, db); got != 7 {
		t.Fatalf("expected 7 seeded rows, got %d", got)
	}

	normalized, removed, err := NormalizeUserThirds(db)
	if err != nil {
		t.Fatalf("NormalizeUserThirds: %v", err)
	}
	if normalized != 3 {
		t.Errorf("normalized = %d, want 3 (GITHUB, webauth, empty op)", normalized)
	}
	if removed != 3 {
		t.Errorf("removed = %d, want 3 (empty open_id + 2 duplicates)", removed)
	}

	// Exactly the 4 kept rows remain.
	if got := countThirdRows(t, db); got != 4 {
		t.Fatalf("rows after migration = %d, want 4", got)
	}

	var rows []model.UserThird
	if err := db.Select("id", "op", "open_id").Order("id ASC").Find(&rows).Error; err != nil {
		t.Fatalf("read user_thirds: %v", err)
	}
	seen := make(map[string]uint, len(rows))
	for _, r := range rows {
		if r.Op != model.OauthTypeGithub {
			t.Errorf("row id=%d: op = %q, want %q", r.Id, r.Op, model.OauthTypeGithub)
		}
		if strings.TrimSpace(r.OpenId) == "" {
			t.Errorf("row id=%d: empty open_id survived migration", r.Id)
		}
		key := r.Op + "\x00" + r.OpenId
		if prev, dup := seen[key]; dup {
			t.Errorf("rows %d and %d share (op, open_id) = (%s, %s)", prev, r.Id, r.Op, r.OpenId)
		}
		seen[key] = r.Id
	}

	// The earliest binding wins: id 1 (github/11) must be kept, id 2 (GITHUB/22)
	// normalized and kept over id 7 (github/22).
	if _, ok := seen["github\x0011"]; !ok {
		t.Error("earliest binding github/11 is missing")
	}
	if seen["github\x0011"] != first.Id {
		t.Errorf("kept github/11 row id = %d, want %d (lowest id)", seen["github\x0011"], first.Id)
	}
	if seen["github\x0022"] != 2 {
		t.Errorf("kept github/22 row id = %d, want 2 (lowest id)", seen["github\x0022"])
	}

	// The composite unique index must exist and actually enforce uniqueness.
	if !db.Migrator().HasIndex(&model.UserThird{}, userThirdsUniqueIndexName) {
		t.Fatalf("unique index %s not created", userThirdsUniqueIndexName)
	}
	dup := model.UserThird{UserId: 1, Op: "github"}
	dup.OpenId = "11"
	if err := db.Create(&dup).Error; err == nil {
		t.Error("inserting duplicate (github, 11) succeeded; unique index is not enforced")
	}

	// The index must be composite: the same open_id under a different op is
	// allowed (it would be rejected by a single-column unique index on open_id).
	other := model.UserThird{UserId: 1, Op: "webauth"}
	other.OpenId = "11"
	if err := db.Create(&other).Error; err != nil {
		t.Errorf("inserting (webauth, 11) failed: %v; index may not be composite", err)
	}
	if err := db.Delete(&other).Error; err != nil {
		t.Fatalf("cleanup (webauth, 11): %v", err)
	}

	// Second run must be a no-op.
	normalized2, removed2, err := NormalizeUserThirds(db)
	if err != nil {
		t.Fatalf("second NormalizeUserThirds: %v", err)
	}
	if normalized2 != 0 || removed2 != 0 {
		t.Errorf("second run not idempotent: normalized=%d removed=%d, want 0/0", normalized2, removed2)
	}
	if got := countThirdRows(t, db); got != 4 {
		t.Errorf("rows after second run = %d, want 4", got)
	}
}

func TestNormalizeUserThirdsEmptyTable(t *testing.T) {
	db := newUserThirdsTestDB(t)
	normalized, removed, err := NormalizeUserThirds(db)
	if err != nil {
		t.Fatalf("NormalizeUserThirds: %v", err)
	}
	if normalized != 0 || removed != 0 {
		t.Errorf("empty table run: normalized=%d removed=%d, want 0/0", normalized, removed)
	}
	if !db.Migrator().HasIndex(&model.UserThird{}, userThirdsUniqueIndexName) {
		t.Errorf("unique index %s missing on fresh table", userThirdsUniqueIndexName)
	}
}

func TestNormalizeUserThirdsMissingTable(t *testing.T) {
	dsn := fmt.Sprintf("file:%s-missing?mode=memory&cache=shared",
		strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		t.Fatalf("open in-memory sqlite: %v", err)
	}
	normalized, removed, err := NormalizeUserThirds(db)
	if err != nil {
		t.Fatalf("NormalizeUserThirds: %v", err)
	}
	if normalized != 0 || removed != 0 {
		t.Errorf("missing table run: normalized=%d removed=%d, want 0/0", normalized, removed)
	}
}

func TestNormalizeUserThirdsNilDB(t *testing.T) {
	normalized, removed, err := NormalizeUserThirds(nil)
	if err != nil || normalized != 0 || removed != 0 {
		t.Errorf("nil db: normalized=%d removed=%d err=%v, want 0/0/nil", normalized, removed, err)
	}
}
