package orm

import (
	"fmt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const defaultSqliteDsn = "./data/rustdeskapi.db"

type SqliteConfig struct {
	Dsn          string
	MaxIdleConns int
	MaxOpenConns int
}

// sqliteFilePath 从 DSN 中提取数据库文件路径。
func sqliteFilePath(dsn string) string {
	p := strings.TrimPrefix(dsn, "file:")
	if i := strings.IndexByte(p, '?'); i >= 0 {
		p = p[:i]
	}
	return p
}

// isMemoryDsn 判断是否为内存数据库，内存 DSN 不做文件权限处理。
func isMemoryDsn(dsn string) bool {
	if strings.Contains(dsn, "mode=memory") {
		return true
	}
	p := sqliteFilePath(dsn)
	return p == "" || p == ":memory:"
}

// hardenSqliteFiles 在打开数据库前收窄文件权限，避免数据库及 WAL/日志文件被其他用户读取。
func hardenSqliteFiles(dsn string) {
	if isMemoryDsn(dsn) {
		return
	}
	path := sqliteFilePath(dsn)
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		fmt.Println("create sqlite data dir fail:", err)
		return
	}
	if dir != "." {
		if err := os.Chmod(dir, 0700); err != nil {
			fmt.Println("chmod sqlite data dir fail:", err)
		}
	}
	if _, err := os.Stat(path); err == nil {
		if err := os.Chmod(path, 0600); err != nil {
			fmt.Println("chmod sqlite db file fail:", err)
		}
	}
}

func NewSqlite(sqliteConf *SqliteConfig, logwriter logger.Writer) *gorm.DB {
	dsn := sqliteConf.Dsn
	if dsn == "" {
		dsn = defaultSqliteDsn
	}
	hardenSqliteFiles(dsn)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
		Logger: logger.New(
			logwriter, // io writer
			logger.Config{
				SlowThreshold:             time.Second, // Slow SQL threshold
				LogLevel:                  logger.Warn, // Log level
				IgnoreRecordNotFoundError: true,        // Ignore ErrRecordNotFound error for logger
				ParameterizedQueries:      true,        // Don't include params in the SQL log
				Colorful:                  true,
			},
		),
	})
	if err != nil {
		fmt.Println(err)
	}
	sqlDB, err2 := db.DB()
	if err2 != nil {
		fmt.Println(err2)
	}
	// SetMaxIdleConns 设置空闲连接池中连接的最大数量
	sqlDB.SetMaxIdleConns(sqliteConf.MaxIdleConns)

	// SetMaxOpenConns 设置打开数据库连接的最大数量。
	sqlDB.SetMaxOpenConns(sqliteConf.MaxOpenConns)

	return db
}
