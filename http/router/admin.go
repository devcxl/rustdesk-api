package router

import (
	"github.com/gin-gonic/gin"
	_ "github.com/lejianwen/rustdesk-api/v2/docs/admin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/controller/admin"
	"github.com/lejianwen/rustdesk-api/v2/http/middleware"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func Init(g *gin.Engine) {
	if global.Config.App.ShowSwagger == 1 {
		g.GET("/admin/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler, ginSwagger.InstanceName("admin")))
	}

	adg := g.Group("/api/admin")
	LoginBind(adg)
	ConfigBind(adg)

	adg.Use(middleware.BackendUserAuth())
	UserBind(adg)
	TagBind(adg)
	AddressBookBind(adg)
	PeerBind(adg)
	OauthBind(adg)
}

func LoginBind(rg *gin.RouterGroup) {
	cont := &admin.Login{}
	rg.POST("/logout", cont.Logout)
	rg.GET("/login-options", cont.LoginOptions)
	rg.POST("/oidc/auth", cont.OidcAuth)
	rg.GET("/oidc/auth-query", cont.OidcAuthQuery)
}

func UserBind(rg *gin.RouterGroup) {
	aR := rg.Group("/user")
	{
		cont := &admin.User{}
		aR.GET("/current", cont.Current)
		aR.POST("/changeCurPwd", cont.ChangeCurPwd)
		aR.POST("/myOauth", cont.MyOauth)
	}
}

func TagBind(rg *gin.RouterGroup) {
	aR := rg.Group("/tag")
	{
		cont := &admin.Tag{}
		aR.GET("/list", cont.List)
		aR.GET("/detail/:id", cont.Detail)
		aR.POST("/create", cont.Create)
		aR.POST("/update", cont.Update)
		aR.POST("/delete", cont.Delete)
	}
}

func AddressBookBind(rg *gin.RouterGroup) {
	aR := rg.Group("/address_book")
	{
		cont := &admin.AddressBook{}
		aR.GET("/list", cont.List)
		aR.GET("/detail/:id", cont.Detail)
		aR.POST("/create", cont.Create)
		aR.POST("/update", cont.Update)
		aR.POST("/delete", cont.Delete)
		aR.POST("/batchCreate", cont.BatchCreate)
		aR.POST("/batchCreateFromPeers", cont.BatchCreateFromPeers)
	}
}

func PeerBind(rg *gin.RouterGroup) {
	aR := rg.Group("/peer")
	{
		cont := &admin.Peer{}
		aR.POST("/simpleData", cont.SimpleData)
		aR.GET("/list", cont.List)
		aR.GET("/detail/:id", cont.Detail)
		aR.POST("/create", cont.Create)
		aR.POST("/update", cont.Update)
		aR.POST("/delete", cont.Delete)
		aR.POST("/batchDelete", cont.BatchDelete)
	}
}

func OauthBind(rg *gin.RouterGroup) {
	aR := rg.Group("/oauth")
	{
		cont := &admin.Oauth{}
		aR.POST("/confirm", cont.Confirm)
		aR.POST("/bind", cont.ToBind)
		aR.POST("/bindConfirm", cont.BindConfirm)
		aR.POST("/unbind", cont.Unbind)
		aR.GET("/info", cont.Info)
	}
}

func ConfigBind(rg *gin.RouterGroup) {
	aR := rg.Group("/config")
	rs := &admin.Config{}

	aR.GET("/admin", rs.AdminConfig)

	aR.Use(middleware.BackendUserAuth())
	aR.GET("/server", rs.ServerConfig)
	aR.GET("/app", rs.AppConfig)
}
