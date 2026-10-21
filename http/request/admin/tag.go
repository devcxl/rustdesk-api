package admin

import "github.com/lejianwen/rustdesk-api/v2/model"

type TagForm struct {
	Id           uint   `json:"id"`
	Name         string `json:"name" validate:"required"`
	Color        uint   `json:"color" validate:"required"`
	UserId       uint   `json:"user_id"`
	CollectionId uint   `json:"collection_id"`
}

func (f *TagForm) ToTag() *model.Tag {
	i := &model.Tag{}
	i.Id = f.Id
	i.Name = f.Name
	i.Color = f.Color
	i.UserId = f.UserId
	i.CollectionId = f.CollectionId
	return i
}

type TagQuery struct {
	UserId       int  `form:"user_id"`
	IsMy         int  `form:"is_my"`
	CollectionId *int `form:"collection_id"`
	PageQuery
}
