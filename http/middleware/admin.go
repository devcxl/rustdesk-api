package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	"github.com/lejianwen/rustdesk-api/v2/service"
)

// BackendUserAuth 后台权限验证中间件
func BackendUserAuth() gin.HandlerFunc {
	return func(c *gin.Context) {

		//测试先关闭
		token := c.GetHeader("api-token")
		if token == "" {
			response.Fail(c, 403, response.TranslateMsg(c, "NeedLogin"))
			c.Abort()
			return
		}
		// 配置了 jwt.key 时, 管理端与客户端 Bearer 路径一致地校验 JWT 有效期。
		if len(global.Jwt.Key) > 0 {
			uid, _ := service.AllService.UserService.VerifyJWT(token)
			if uid == 0 {
				response.Fail(c, 403, response.TranslateMsg(c, "NeedLogin"))
				c.Abort()
				return
			}
		}
		user, ut := service.AllService.UserService.InfoByAccessToken(token)
		if user.Id == 0 {
			response.Fail(c, 403, response.TranslateMsg(c, "NeedLogin"))
			c.Abort()
			return
		}

		if !service.AllService.UserService.CheckUserEnable(user) {
			c.JSON(401, gin.H{
				"error": "Unauthorized",
			})
			c.Abort()
			return
		}

		c.Set("curUser", user)
		c.Set("token", token)
		//如果时间小于1天,token自动续期
		service.AllService.UserService.AutoRefreshAccessToken(ut)

		c.Next()
	}
}
