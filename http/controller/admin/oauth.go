package admin

import (
	"github.com/gin-gonic/gin"
	adminReq "github.com/lejianwen/rustdesk-api/v2/http/request/admin"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	"github.com/lejianwen/rustdesk-api/v2/service"
)

type Oauth struct {
}

// Info
func (o *Oauth) Info(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError"))
		return
	}
	v := service.AllService.OauthService.GetOauthCache(code)
	if v == nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ItemNotFound"))
		return
	}
	response.Success(c, v)
}

func (o *Oauth) ToBind(c *gin.Context) {
	f := &adminReq.BindOauthForm{}
	err := c.ShouldBindJSON(f)
	if err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	u := service.AllService.UserService.CurUser(c)

	utr := service.AllService.UserService.UserThirdInfo(u.Id, f.Op)
	if utr.Id > 0 {
		response.Fail(c, 101, response.TranslateMsg(c, "OauthHasBindOtherUser"))
		return
	}

	err, state, verifier, nonce, url := service.AllService.OauthService.BeginAuth(f.Op)
	if err != nil {
		response.Error(c, response.TranslateMsg(c, err.Error()))
		return
	}

	service.AllService.OauthService.SetOauthCache(state, &service.OauthCacheItem{
		Action:   service.OauthActionTypeBind,
		Op:       f.Op,
		UserId:   u.Id,
		Verifier: verifier,
		Nonce:    nonce,
	}, 5*60)

	response.Success(c, gin.H{
		"code": state,
		"url":  url,
	})
}

// Confirm 确认授权登录
func (o *Oauth) Confirm(c *gin.Context) {
	j := &adminReq.OauthConfirmForm{}
	err := c.ShouldBindJSON(j)
	if err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	if j.Code == "" {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError"))
		return
	}
	v := service.AllService.OauthService.GetOauthCache(j.Code)
	if v == nil {
		response.Fail(c, 101, response.TranslateMsg(c, "OauthExpired"))
		return
	}
	u := service.AllService.UserService.CurUser(c)
	v.UserId = u.Id
	service.AllService.OauthService.SetOauthCache(j.Code, v, 0)
	response.Success(c, v)
}

func (o *Oauth) BindConfirm(c *gin.Context) {
	j := &adminReq.OauthConfirmForm{}
	err := c.ShouldBindJSON(j)
	if err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	if j.Code == "" {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError"))
		return
	}
	oauthService := service.AllService.OauthService
	oauthCache := oauthService.GetOauthCache(j.Code)
	if oauthCache == nil {
		response.Fail(c, 101, response.TranslateMsg(c, "OauthExpired"))
		return
	}
	oauthUser := oauthCache.ToOauthUser()
	user := service.AllService.UserService.CurUser(c)
	err = oauthService.BindOauthUser(user.Id, oauthUser, oauthCache.Op)
	if err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "BindFail"))
		return
	}

	oauthCache.UserId = user.Id
	oauthService.SetOauthCache(j.Code, oauthCache, 0)
	response.Success(c, oauthCache)
}

func (o *Oauth) Unbind(c *gin.Context) {
	f := &adminReq.UnBindOauthForm{}
	err := c.ShouldBindJSON(f)
	if err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	u := service.AllService.UserService.CurUser(c)
	utr := service.AllService.UserService.UserThirdInfo(u.Id, f.Op)
	if utr.Id == 0 {
		response.Fail(c, 101, response.TranslateMsg(c, "ItemNotFound"))
		return
	}
	err = service.AllService.OauthService.UnBindOauthUser(u.Id, f.Op)
	if err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "OperationFailed")+err.Error())
		return
	}
	response.Success(c, nil)
}
