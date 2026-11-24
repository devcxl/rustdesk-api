package logger

import (
	"fmt"
	nested "github.com/antonfisher/nested-logrus-formatter"
	log "github.com/sirupsen/logrus"
	"io"
	"os"
	"path/filepath"
)

const (
	DebugMode   = "debug"
	ReleaseMode = "release"

	logDirPerm  = os.FileMode(0750)
	logFilePerm = os.FileMode(0640)
)

type Config struct {
	Path         string
	Level        string
	ReportCaller bool
}

func New(c *Config) *log.Logger {
	log.SetFormatter(&nested.Formatter{
		// HideKeys:        true,
		TimestampFormat: "[2006-01-02 15:04:05]",
		NoColors:        true,
		NoFieldsColors:  true,
		//FieldsOrder:     []string{"name", "age"},
	})

	// 日志文件
	f := c.Path
	var write io.Writer
	if f != "" {
		// 日志可能包含敏感信息，目录与文件权限收窄到仅服务账号可读写。
		dir := filepath.Dir(f)
		if err := os.MkdirAll(dir, logDirPerm); err != nil {
			panic("create log directory fail: " + err.Error())
		}
		if dir != "." {
			if err := os.Chmod(dir, logDirPerm); err != nil {
				fmt.Fprintln(os.Stderr, "chmod log directory fail:", err)
			}
		}
		fwriter, err := os.OpenFile(f, os.O_WRONLY|os.O_CREATE|os.O_APPEND, logFilePerm)
		if err != nil {
			panic("open log file fail!")
		}
		// 兼容历史版本以 0644 创建的文件。
		if err := fwriter.Chmod(logFilePerm); err != nil {
			fmt.Fprintln(os.Stderr, "chmod log file fail:", err)
		}
		write = io.MultiWriter(fwriter, os.Stdout)
	} else {
		write = os.Stdout
	}

	log.SetOutput(write)

	log.SetReportCaller(c.ReportCaller)

	level, err2 := log.ParseLevel(c.Level)
	if err2 != nil {
		level = log.InfoLevel
	}
	log.SetLevel(level)

	return log.StandardLogger()
}
