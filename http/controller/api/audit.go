package api

import (
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
)

type Audit struct {
}

// AuditConn 审计连接 (单人模式静默成功)
func (a *Audit) AuditConn(c *gin.Context) {
	response.Success(c, "")
}

// AuditFile 审计文件 (单人模式静默成功)
func (a *Audit) AuditFile(c *gin.Context) {
	response.Success(c, "")
}
