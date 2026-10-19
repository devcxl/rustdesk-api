package admin

type BindOauthForm struct {
	Op string `json:"op" binding:"required"`
}

type OauthConfirmForm struct {
	Code string `json:"code" binding:"required"`
}

type UnBindOauthForm struct {
	Op string `json:"op" binding:"required"`
}
