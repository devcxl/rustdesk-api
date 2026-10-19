package admin

import (
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/request/admin"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	adResp "github.com/lejianwen/rustdesk-api/v2/http/response/admin"
	"github.com/lejianwen/rustdesk-api/v2/service"
	"github.com/lejianwen/rustdesk-api/v2/utils"
)

type User struct {
}

// Current 当前用户
// @Tags 用户
// @Summary 当前用户
// @Description 当前用户
// @Accept  json
// @Produce  json
// @Success 200 {object} response.Response{data=adResp.LoginPayload}
// @Failure 500 {object} response.Response
// @Router /admin/user/current [get]
// @Security token
func (ct *User) Current(c *gin.Context) {
	u := service.AllService.UserService.CurUser(c)
	token, _ := c.Get("token")
	t := token.(string)
	responseLoginSuccess(c, u, t)
}

// ChangeCurPwd 修改当前用户密码
// @Tags 用户
// @Summary 修改当前用户密码
// @Description 修改当前用户密码
// @Accept  json
// @Produce  json
// @Param body body admin.ChangeCurPasswordForm true "用户信息"
// @Success 200 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /admin/user/changeCurPwd [post]
// @Security token
func (ct *User) ChangeCurPwd(c *gin.Context) {
	f := &admin.ChangeCurPasswordForm{}
	if err := c.ShouldBindJSON(f); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}

	errList := global.Validator.ValidStruct(c, f)
	if len(errList) > 0 {
		response.Fail(c, 101, errList[0])
		return
	}
	u := service.AllService.UserService.CurUser(c)
	// Verify the old password only when the account already has one set
	if !service.AllService.UserService.IsPasswordEmptyByUser(u) {
		ok, _, err := utils.VerifyPassword(u.Password, f.OldPassword)
		if err != nil || !ok {
			response.Fail(c, 101, response.TranslateMsg(c, "OldPasswordError"))
			return
		}
	}
	err := service.AllService.UserService.UpdatePassword(u, f.NewPassword)
	if err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "OperationFailed")+err.Error())
		return
	}
	response.Success(c, nil)
}

// MyOauth 我的授权
// @Tags 用户
// @Summary 我的授权
// @Description 我的授权
// @Accept  json
// @Produce  json
// @Success 200 {object} response.Response{data=[]adResp.UserOauthItem}
// @Failure 500 {object} response.Response
// @Router /admin/user/myOauth [get]
// @Security token
func (ct *User) MyOauth(c *gin.Context) {
	u := service.AllService.UserService.CurUser(c)
	oal := service.AllService.OauthService.List(1, 100, nil)
	uts := service.AllService.UserService.UserThirdsByUserId(u.Id)
	var res []*adResp.UserOauthItem
	for _, oa := range oal.Oauths {
		item := &adResp.UserOauthItem{
			Op: oa.Op,
		}
		for _, ut := range uts {
			if ut.Op == oa.Op {
				item.Status = 1
				break
			}
		}
		res = append(res, item)
	}
	response.Success(c, res)
}
