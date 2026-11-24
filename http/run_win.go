//go:build windows

package http

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func Run(g *gin.Engine, addr string) {
	srv := &http.Server{
		Addr:              addr,
		Handler:           g,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		// OAuth exchange, profile, org and email calls each have a 60s client timeout.
		WriteTimeout:   180 * time.Second,
		IdleTimeout:    120 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	_ = srv.ListenAndServe()
}
