package api

import (
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	"github.com/lejianwen/rustdesk-api/v2/http/response/api"
	"github.com/lejianwen/rustdesk-api/v2/service"
)

type WebClient struct {
}

// ServerConfig 服务配置
// @Tags WEBCLIENT
// @Summary 服务配置
// @Description 服务配置,给webclient提供api-server
// @Accept  json
// @Produce  json
// @Success 200 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /server-config [get]
// @Security token
func (i *WebClient) ServerConfig(c *gin.Context) {
	u := service.AllService.UserService.CurUser(c)

	peers := map[string]*api.WebClientPeerPayload{}
	abs := service.AllService.AddressBookService.ListByUserIdAndCollectionId(u.Id, 0, 1, 100)
	for _, ab := range abs.AddressBooks {
		pp := &api.WebClientPeerPayload{}
		pp.FromAddressBook(ab)
		peers[ab.Id] = pp
	}
	response.Success(
		c,
		gin.H{
			"id_server": global.Config.Rustdesk.IdServer,
			"key":       global.Config.Rustdesk.Key,
			"peers":     peers,
		},
	)
}

// ServerConfigV2 服务配置
// @Tags WEBCLIENT_V2
// @Summary 服务配置
// @Description 服务配置,给webclient提供api-server
// @Accept  json
// @Produce  json
// @Success 200 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /server-config-v2 [get]
// @Security token
func (i *WebClient) ServerConfigV2(c *gin.Context) {
	response.Success(
		c,
		gin.H{
			"id_server": global.Config.Rustdesk.IdServer,
			"key":       global.Config.Rustdesk.Key,
		},
	)
}
