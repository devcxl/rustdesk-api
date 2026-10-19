package model

type Tag struct {
	IdModel
	Name         string `json:"name" gorm:"default:'';not null;"`
	UserId       uint   `json:"user_id" gorm:"default:0;not null;index"`
	Color        uint   `json:"color" gorm:"default:0;not null;"`
	CollectionId uint   `json:"collection_id" gorm:"default:0;not null;index"`
	TimeModel
}

type TagList struct {
	Tags []*Tag `json:"list"`
	Pagination
}
