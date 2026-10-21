package response

import (
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/nicksnyder/go-i18n/v2/i18n"
	"net/http"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}
type DataResponse struct {
	Total uint        `json:"total"`
	Data  interface{} `json:"data"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func SendResponse(c *gin.Context, code int, message string, data interface{}) {
	c.JSON(http.StatusOK, Response{
		code, message, data,
	})
}

func Success(c *gin.Context, data interface{}) {
	SendResponse(c, 0, "success", data)
}

func Fail(c *gin.Context, code int, message string) {
	SendResponse(c, code, message, nil)
}

func Error(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Error: message,
	})
}

type ServerConfigResponse struct {
	IdServer    string `json:"id_server"`
	Key         string `json:"key"`
	RelayServer string `json:"relay_server"`
	ApiServer   string `json:"api_server"`
}

func TranslateMsg(c *gin.Context, messageId string) string {
	localizer := global.Localizer(c.GetHeader("Accept-Language"))
	errMsg, err := localizer.LocalizeMessage(&i18n.Message{
		ID: messageId,
	})
	if err != nil {
		global.Logger.Warn("LocalizeMessage Error: " + err.Error())
		errMsg = messageId
	}
	return errMsg
}
