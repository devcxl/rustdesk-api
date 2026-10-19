package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	apiReq "github.com/lejianwen/rustdesk-api/v2/http/request/api"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	apiResp "github.com/lejianwen/rustdesk-api/v2/http/response/api"
	"github.com/lejianwen/rustdesk-api/v2/service"
)

type Group struct {
}

// Users 用户列表 (单人模式仅返回当前用户)
func (g *Group) Users(c *gin.Context) {
	u := service.AllService.UserService.CurUser(c)
	data := make([]*apiResp.UserPayload, 0, 1)
	if u != nil {
		up := &apiResp.UserPayload{}
		up.FromUser(u)
		data = append(data, up)
	}
	c.JSON(http.StatusOK, response.DataResponse{
		Total: uint(len(data)),
		Data:  data,
	})
}

// Peers 机器 (单人模式返回个人设备列表)
func (g *Group) Peers(c *gin.Context) {
	u := service.AllService.UserService.CurUser(c)
	q := &apiReq.PeerListQuery{}
	_ = c.ShouldBindQuery(&q)

	peerList := service.AllService.PeerService.ListByUserId(u.Id, q.Page, q.PageSize)
	data := make([]*apiResp.GroupPeerPayload, 0, len(peerList.Peers))
	for _, peer := range peerList.Peers {
		pp := &apiResp.GroupPeerPayload{}
		pp.FromPeer(peer, u.Username, "")
		data = append(data, pp)
	}
	c.JSON(http.StatusOK, response.DataResponse{
		Total: uint(peerList.Total),
		Data:  data,
	})
}

// Device 设备组 (单人模式直接返回空)
func (g *Group) Device(c *gin.Context) {
	c.JSON(http.StatusOK, response.DataResponse{
		Total: 0,
		Data:  []interface{}{},
	})
}
