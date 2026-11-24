//go:build !windows

package http

import (
	"time"

	"github.com/fvbock/endless"
	"github.com/gin-gonic/gin"
)

func Run(g *gin.Engine, addr string) {
	srv := endless.NewServer(addr, g)
	srv.ReadHeaderTimeout = 10 * time.Second
	srv.ReadTimeout = 30 * time.Second
	// OAuth exchange, profile, org and email calls each have a 60s client timeout.
	srv.WriteTimeout = 180 * time.Second
	srv.IdleTimeout = 120 * time.Second
	srv.MaxHeaderBytes = 1 << 20
	_ = srv.ListenAndServe()
}
