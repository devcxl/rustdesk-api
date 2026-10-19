package admin

type PageQuery struct {
	Page     uint `form:"page"`
	PageSize uint `form:"page_size"`
}

type ChangeCurPasswordForm struct {
	OldPassword string `json:"old_password" validate:"required,gte=4,lte=32"`
	NewPassword string `json:"new_password" validate:"required,gte=4,lte=32"`
}
