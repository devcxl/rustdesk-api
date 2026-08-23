package api

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
	"net/http"
)

type Login struct {
}

// LoginOptions
// @Tags 登录
// @Summary 登录选项
// @Description 登录选项
// @Accept  json
// @Produce  json
// @Success 200 {object} []string
// @Failure 500 {object} response.ErrorResponse
// @Router /login-options [get]
func (l *Login) LoginOptions(c *gin.Context) {
	ops := service.AllService.OauthService.GetOauthProviders()
	if global.Config.App.WebSso {
		ops = append(ops, model.OauthTypeWebauth)
	}
	var oidcItems []map[string]string
	for _, v := range ops {
		oidcItems = append(oidcItems, map[string]string{"name": v})
	}
	common, err := json.Marshal(oidcItems)
	if err != nil {
		response.Error(c, response.TranslateMsg(c, "SystemError")+err.Error())
		return
	}
	var res []string
	res = append(res, "common-oidc/"+string(common))
	for _, v := range ops {
		res = append(res, "oidc/"+v)
	}
	c.JSON(http.StatusOK, res)
}

// Logout
// @Tags 登录
// @Summary 登出
// @Description 登出
// @Accept  json
// @Produce  json
// @Success 200 {string} string
// @Failure 500 {object} response.ErrorResponse
// @Router /logout [post]
func (l *Login) Logout(c *gin.Context) {
	u := service.AllService.UserService.CurUser(c)
	token, ok := c.Get("token")
	if ok {
		service.AllService.UserService.Logout(u, token.(string))
	}
	c.JSON(http.StatusOK, nil)

}
