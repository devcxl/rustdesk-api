package api

import (
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/request/api"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	apiResp "github.com/lejianwen/rustdesk-api/v2/http/response/api"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
	"github.com/lejianwen/rustdesk-api/v2/utils"
	"github.com/nicksnyder/go-i18n/v2/i18n"
)

type Oauth struct {
}

// OidcAuth
// @Tags Oauth
// @Summary OidcAuth
// @Description OidcAuth
// @Accept  json
// @Produce  json
// @Success 200 {object} apiResp.LoginRes
// @Failure 500 {object} response.ErrorResponse
// @Router /oidc/auth [post]
func (o *Oauth) OidcAuth(c *gin.Context) {
	f := &api.OidcAuthRequest{}
	err := c.ShouldBindJSON(&f)
	if err != nil {
		response.Error(c, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}

	if err := service.ValidateOidcAuthParams(f.Id, f.Uuid, f.Op, f.DeviceInfo.Name, f.DeviceInfo.Os, f.DeviceInfo.Type); err != nil {
		response.Error(c, response.TranslateMsg(c, "ParamsError"))
		return
	}

	oauthService := service.AllService.OauthService
	// Persist the canonical provider so later lookups and identity rows cannot
	// diverge on client-supplied op variants.
	op := service.NormalizeOp(f.Op)

	err, state, verifier, nonce, url := oauthService.BeginAuth(op)
	if err != nil {
		response.Error(c, response.TranslateMsg(c, err.Error()))
		return
	}

	service.AllService.OauthService.SetOauthCache(state, &service.OauthCacheItem{
		Action:     service.OauthActionTypeLogin,
		Id:         f.Id,
		Op:         op,
		Uuid:       f.Uuid,
		DeviceName: f.DeviceInfo.Name,
		DeviceOs:   f.DeviceInfo.Os,
		DeviceType: f.DeviceInfo.Type,
		Verifier:   verifier,
		Nonce:      nonce,
	}, 5*60)
	//fmt.Println("code url", code, url)
	c.JSON(http.StatusOK, gin.H{
		"code": state,
		"url":  url,
	})
}

func (o *Oauth) OidcAuthQueryPre(c *gin.Context) (*model.User, *model.UserToken) {
	var u *model.User
	var ut *model.UserToken
	q := &api.OidcAuthQuery{}

	// 解析查询参数并处理错误
	if err := c.ShouldBindQuery(q); err != nil {
		response.Error(c, response.TranslateMsg(c, "ParamsError")+": "+err.Error())
		return nil, nil
	}

	// 获取 OAuth 缓存
	v := service.AllService.OauthService.GetOauthCache(q.Code)
	if v == nil {
		response.Error(c, response.TranslateMsg(c, "OauthExpired"))
		return nil, nil
	}

	// webadmin 流程必须由发起授权的同一浏览器兑换；桌面端没有绑定.
	if !browserBindingMatches(c, v.BrowserBinding) {
		service.AllService.OauthService.DeleteOauthCache(q.Code)
		response.Error(c, response.TranslateMsg(c, "OauthExpired"))
		return nil, nil
	}

	// 如果 UserId 为 0，说明还在授权中
	if v.UserId == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "Authorization in progress, please login and bind", "error": "No authed oidc is found"})
		return nil, nil
	}

	// 获取用户信息
	u = service.AllService.UserService.InfoById(v.UserId)
	if u == nil || u.Id == 0 {
		service.AllService.OauthService.DeleteOauthCache(q.Code)
		response.Error(c, response.TranslateMsg(c, "UserNotFound"))
		return nil, nil
	}
	// Fail closed for disabled or deleted accounts: never issue a fresh token
	// (or a user_id=0 token row) for a cached identity that is no longer valid.
	if !service.AllService.UserService.CheckUserEnable(u) {
		service.AllService.OauthService.DeleteOauthCache(q.Code)
		response.Error(c, response.TranslateMsg(c, "NoAccess"))
		return nil, nil
	}

	// 删除 OAuth 缓存
	service.AllService.OauthService.DeleteOauthCache(q.Code)

	// 生成用户令牌
	ut = service.AllService.UserService.Login(u, &service.LoginParams{
		DeviceId:   v.Id,
		DeviceUuid: v.Uuid,
		Client:     v.DeviceType,
		Platform:   v.DeviceOs,
		Ip:         c.ClientIP(),
	})

	if ut == nil {
		response.Error(c, response.TranslateMsg(c, "LoginFailed"))
		return nil, nil
	}

	// 返回用户令牌
	return u, ut
}

// OidcAuthQuery
// @Tags Oauth
// @Summary OidcAuthQuery
// @Description OidcAuthQuery
// @Accept  json
// @Produce  json
// @Success 200 {object} apiResp.LoginRes
// @Failure 500 {object} response.ErrorResponse
// @Router /oidc/auth-query [get]
func (o *Oauth) OidcAuthQuery(c *gin.Context) {
	u, ut := o.OidcAuthQueryPre(c)
	if u == nil || ut == nil {
		return
	}
	c.JSON(http.StatusOK, apiResp.LoginRes{
		AccessToken: ut.Token,
		Type:        "access_token",
		User:        *(&apiResp.UserPayload{}).FromUser(u),
	})
}

// webadminCallbackRedirect returns the SPA route that finishes a web login.
// The one-time state lives in the URL fragment, so it is not sent to the server
// in Referer/logs and is consumed by the follow-up auth-query poll.
func webadminCallbackRedirect(state string) string {
	return "/_admin/#/oauth/callback?state=" + url.QueryEscape(state)
}

// OauthCallback 回调
// @Tags Oauth
// @Summary OauthCallback
// @Description OauthCallback
// @Accept  json
// @Produce  json
// @Success 200 {object} apiResp.LoginRes
// @Failure 500 {object} response.ErrorResponse
// @Router /oidc/callback [get]
func (o *Oauth) OauthCallback(c *gin.Context) {
	state := c.Query("state")
	if state == "" {
		c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
			"message":     "ParamIsEmpty",
			"sub_message": "state",
		})
		return
	}
	cacheKey := state
	oauthService := service.AllService.OauthService
	//从缓存中获取
	oauthCache := oauthService.GetOauthCache(cacheKey)
	if oauthCache == nil {
		c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
			"message": "OauthExpired",
		})
		return
	}
	// webadmin 登录只能在发起授权的浏览器中完成；桌面端不设置绑定.
	if !browserBindingMatches(c, oauthCache.BrowserBinding) {
		oauthService.DeleteOauthCache(cacheKey)
		c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
			"message": "OauthFailed",
		})
		return
	}
	code := c.Query("code")
	if code == "" {
		oauthService.DeleteOauthCache(cacheKey)
		c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
			"message":     "ParamIsEmpty",
			"sub_message": "code",
		})
		return
	}
	// A completed login state must not be exchangeable again.
	if oauthCache.Action == service.OauthActionTypeLogin && oauthCache.UserId != 0 {
		oauthService.DeleteOauthCache(cacheKey)
		c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
			"message": "OauthHasBeenSuccess",
		})
		return
	}

	nonce := oauthCache.Nonce
	// Normalize legacy/variant cached ops before any identity lookup or write.
	op := service.NormalizeOp(oauthCache.Op)
	oauthCache.Op = op
	action := oauthCache.Action
	verifier := oauthCache.Verifier
	var user *model.User
	// 获取用户信息
	err, oauthUser := oauthService.Callback(c.Request.Context(), code, verifier, op, nonce)
	if err != nil {
		// Failed exchanges are single-use; drop the state so it cannot be replayed.
		oauthService.DeleteOauthCache(cacheKey)
		c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
			"message":     "OauthFailed",
			"sub_message": err.Error(),
		})
		return
	}
	userId := oauthCache.UserId
	openid := oauthUser.OpenId
	if action == service.OauthActionTypeBind {

		//fmt.Println("bind", ty, userData)
		// 检查此openid是否已经绑定过
		utr := oauthService.UserThirdInfo(op, openid)
		if utr.UserId > 0 {
			c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
				"message": "OauthHasBindOtherUser",
			})
			return
		}
		//绑定
		user = service.AllService.UserService.InfoById(userId)
		if user == nil {
			c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
				"message": "ItemNotFound",
			})
			return
		}
		//绑定
		err := oauthService.BindOauthUser(userId, oauthUser, op)
		if err != nil {
			c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
				"message": "BindFail",
			})
			return
		}
		c.HTML(http.StatusOK, "oauth_success.html", gin.H{
			"message": "BindSuccess",
		})
		return

	} else if action == service.OauthActionTypeLogin {
		//登录
		if userId != 0 {
			c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
				"message": "OauthHasBeenSuccess",
			})
			return
		}
		user = service.AllService.UserService.InfoByOauthId(op, openid)
		if user == nil {
			oauthConfig := oauthService.InfoByOp(op)
			if !*oauthConfig.AutoRegister {
				//c.String(http.StatusInternalServerError, "还未绑定用户，请先绑定")
				oauthCache.UpdateFromOauthUser(oauthUser)
				c.Redirect(http.StatusFound, "/_admin/#/oauth/bind/"+cacheKey)
				return
			}

			//自动注册
			err, user = service.AllService.UserService.RegisterByOauth(oauthUser, op)
			if err != nil {
				c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
					"message": err.Error(),
				})
				return
			}
		}
		// 确保单人模式下合法登录用户拥有管理员权限
		user = service.AllService.UserService.EnsureAdmin(user)
		oauthCache.UserId = user.Id
		oauthService.SetOauthCache(cacheKey, oauthCache, 0)
		// 如果是webadmin，登录成功后跳转到webadmin
		if oauthCache.DeviceType == "webadmin" {
			/*service.AllService.UserService.Login(u, &model.LoginLog{
				UserId:   u.Id,
				Client:   "webadmin",
				Uuid:     "", //must be empty
				Ip:       c.ClientIP(),
				Type:     model.LoginLogTypeOauth,
				Platform: oauthService.DeviceOs,
			})*/
			c.Redirect(http.StatusFound, webadminCallbackRedirect(cacheKey))
			return
		}
		c.HTML(http.StatusOK, "oauth_success.html", gin.H{
			"message": "OauthSuccess",
		})
		return
	} else {
		c.HTML(http.StatusOK, "oauth_fail.html", gin.H{
			"message": "ParamsError",
		})
		return
	}

}

type MessageParams struct {
	Lang  string `json:"lang" form:"lang"`
	Title string `json:"title" form:"title"`
	Msg   string `json:"msg" form:"msg"`
}

func (o *Oauth) Message(c *gin.Context) {
	mp := &MessageParams{}
	if err := c.ShouldBindQuery(mp); err != nil {
		return
	}
	localizer := global.Localizer(mp.Lang)
	res := ""
	if mp.Title != "" {
		title, err := localizer.LocalizeMessage(&i18n.Message{
			ID: mp.Title,
		})
		if err == nil {
			res = utils.StringConcat(";title='", title, "';")
		}

	}
	if mp.Msg != "" {
		msg, err := localizer.LocalizeMessage(&i18n.Message{
			ID: mp.Msg,
		})
		if err == nil {
			res = utils.StringConcat(res, "msg = '", msg, "';")
		}
	}

	//返回js内容
	c.Header("Content-Type", "application/javascript")
	c.String(http.StatusOK, res)
}
