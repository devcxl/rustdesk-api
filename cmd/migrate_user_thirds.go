package main

import (
	"strings"

	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"gorm.io/gorm"
)

// userThirdsUniqueIndexName is the composite unique index on user_thirds(op, open_id).
// It is declared on model.UserThird.Op and the embedded model.OauthUser.OpenId.
const userThirdsUniqueIndexName = "idx_user_third_op_open_id"

// normalizeBatchSize limits how many primary keys are touched per statement so
// the migration stays portable across MySQL, PostgreSQL and SQLite.
const normalizeBatchSize = 500

// NormalizeUserThirds makes the legacy user_thirds table safe for a composite
// unique index on (op, open_id):
//
//  1. Rows with an empty (or NULL) open_id can never authenticate and would
//     collide on the unique index; they are deleted first.
//  2. Every remaining row gets op = "github", covering NULL/empty/case
//     variants ("GITHUB", "Webauth", ...) portably in Go instead of relying on
//     database collation behavior.
//  3. Duplicates on (op, open_id) are removed keeping the lowest id (the
//     earliest binding); extras are deleted in batches.
//  4. The composite unique index is created when missing.
//
// The function is idempotent: a second run finds nothing to change. It returns
// the number of normalized rows and the number of removed rows.
func NormalizeUserThirds(db *gorm.DB) (normalized int64, removed int64, err error) {
	if db == nil {
		return 0, 0, nil
	}

	// The table only exists once migrations have run (or on a legacy install).
	if !db.Migrator().HasTable(&model.UserThird{}) {
		return 0, 0, nil
	}

	// 1) Delete rows that cannot authenticate: empty or NULL open_id.
	res := db.Where("open_id = '' OR open_id IS NULL").Delete(&model.UserThird{})
	if res.Error != nil {
		return 0, 0, res.Error
	}
	removed += res.RowsAffected

	// 2) Read the remaining rows ordered by id so the earliest binding wins.
	var rows []model.UserThird
	if err := db.Select("id", "op", "open_id").Order("id ASC").Find(&rows).Error; err != nil {
		return normalized, removed, err
	}

	// 3) Decide in Go which rows need an op update and which are duplicates.
	normalizeIds := make([]uint, 0)
	deleteIds := make([]uint, 0)
	seen := make(map[string]struct{}, len(rows))
	for i := range rows {
		r := &rows[i]
		// Whitespace-only open_id values are just as useless as empty ones.
		if strings.TrimSpace(r.OpenId) == "" {
			deleteIds = append(deleteIds, r.Id)
			continue
		}
		if r.Op != model.OauthTypeGithub {
			normalizeIds = append(normalizeIds, r.Id)
		}
		// After normalization every row has op=github, so dedupe on that.
		key := model.OauthTypeGithub + "\x00" + r.OpenId
		if _, dup := seen[key]; dup {
			// Duplicate binding: keep the lowest id (already seen), drop this one.
			deleteIds = append(deleteIds, r.Id)
			continue
		}
		seen[key] = struct{}{}
	}

	// 4) Delete duplicate bindings before rewriting op values: if the unique
	// index already exists, normalizing duplicates first would collide.
	for _, ids := range chunkUintIDs(deleteIds, normalizeBatchSize) {
		res := db.Where("id IN ?", ids).Delete(&model.UserThird{})
		if res.Error != nil {
			return normalized, removed, res.Error
		}
		removed += res.RowsAffected
	}

	// 5) Normalize op values in batches by primary key.
	for _, ids := range chunkUintIDs(normalizeIds, normalizeBatchSize) {
		res := db.Model(&model.UserThird{}).Where("id IN ?", ids).Update("op", model.OauthTypeGithub)
		if res.Error != nil {
			return normalized, removed, res.Error
		}
		normalized += res.RowsAffected
	}

	// 6) Create the composite unique index when it does not exist yet.
	if !db.Migrator().HasIndex(&model.UserThird{}, userThirdsUniqueIndexName) {
		if err := db.Migrator().CreateIndex(&model.UserThird{}, userThirdsUniqueIndexName); err != nil {
			if global.Logger != nil {
				global.Logger.Errorf("user_thirds unique index %s creation failed: %v", userThirdsUniqueIndexName, err)
			}
			return normalized, removed, err
		}
	}

	if global.Logger != nil {
		global.Logger.Infof("user_thirds normalized: %d op updates, %d rows removed (empty open_id or duplicates)",
			normalized, removed)
	}
	return normalized, removed, nil
}

// chunkUintIDs splits a slice of ids into chunks of at most size elements.
func chunkUintIDs(ids []uint, size int) [][]uint {
	if size <= 0 {
		size = normalizeBatchSize
	}
	chunks := make([][]uint, 0, (len(ids)+size-1)/size)
	for len(ids) > 0 {
		n := size
		if len(ids) < n {
			n = len(ids)
		}
		chunks = append(chunks, ids[:n])
		ids = ids[n:]
	}
	return chunks
}
