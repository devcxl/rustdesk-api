package service

import (
	"encoding/json"
	"strings"

	"github.com/lejianwen/rustdesk-api/v2/model"
	"gorm.io/gorm"
)

type AddressBookService struct {
}

func (s *AddressBookService) Info(id string) *model.AddressBook {
	p := &model.AddressBook{}
	DB.Where("id = ?", id).First(p)
	return p
}

func (s *AddressBookService) InfoByUserIdAndId(userid uint, id string) *model.AddressBook {
	p := &model.AddressBook{}
	DB.Where("user_id = ? and id = ?", userid, id).First(p)
	return p
}

func (s *AddressBookService) InfoByUserIdAndIdAndCid(userid uint, id string, cid uint) *model.AddressBook {
	p := &model.AddressBook{}
	DB.Where("user_id = ? and id = ? and collection_id = ?", userid, id, cid).First(p)
	return p
}

func (s *AddressBookService) InfoByRowId(id uint) *model.AddressBook {
	p := &model.AddressBook{}
	DB.Where("row_id = ?", id).First(p)
	return p
}

func (s *AddressBookService) ListByUserId(userId, page, pageSize uint) (res *model.AddressBookList) {
	res = s.List(page, pageSize, func(tx *gorm.DB) {
		tx.Where("user_id = ?", userId)
	})
	return
}

func (s *AddressBookService) ListByUserIds(userIds []uint, page, pageSize uint) (res *model.AddressBookList) {
	res = s.List(page, pageSize, func(tx *gorm.DB) {
		tx.Where("user_id in (?)", userIds)
	})
	return
}

// AddAddressBook
func (s *AddressBookService) AddAddressBook(ab *model.AddressBook) error {
	return DB.Create(ab).Error
}

// UpdateAddressBook
func (s *AddressBookService) UpdateAddressBook(abs []*model.AddressBook, userId uint) error {
	tx := DB.Begin()
	var dbABs []*model.AddressBook
	tx.Where("user_id = ?", userId).Find(&dbABs)

	aBIds := make(map[string]*model.AddressBook)
	for _, ab := range abs {
		aBIds[ab.Id] = ab
	}

	dbABIds := make(map[string]*model.AddressBook)
	for _, dbAb := range dbABs {
		dbABIds[dbAb.Id] = dbAb
	}

	for id, ab := range aBIds {
		dbAB, ok := dbABIds[id]
		ab.UserId = userId
		if !ok {
			if ab.Platform == "" || ab.Username == "" || ab.Hostname == "" {
				peer := AllService.PeerService.FindById(ab.Id)
				if peer.RowId != 0 {
					ab.Platform = AllService.AddressBookService.PlatformFromOs(peer.Os)
					ab.Username = peer.Username
					ab.Hostname = peer.Hostname
				}
			}
			tx.Create(ab)
		} else {
			tx.Model(&model.AddressBook{}).Where("row_id = ?", dbAB.RowId).Updates(ab)
		}
	}

	for id, dbAB := range dbABIds {
		_, ok := aBIds[id]
		if !ok {
			tx.Delete(dbAB)
		}
	}
	tx.Commit()
	return nil
}

func (s *AddressBookService) List(page, pageSize uint, where func(tx *gorm.DB)) (res *model.AddressBookList) {
	res = &model.AddressBookList{}
	res.Page = int64(page)
	res.PageSize = int64(pageSize)
	tx := DB.Model(&model.AddressBook{})
	if where != nil {
		where(tx)
	}
	tx.Count(&res.Total)
	tx.Scopes(Paginate(page, pageSize))
	tx.Find(&res.AddressBooks)
	return
}

func (s *AddressBookService) FromPeer(peer *model.Peer) (a *model.AddressBook) {
	a = &model.AddressBook{}
	a.Id = peer.Id
	a.Username = peer.Username
	a.Hostname = peer.Hostname
	a.UserId = peer.UserId
	a.Platform = s.PlatformFromOs(peer.Os)
	return a
}

// Create 创建
func (s *AddressBookService) Create(u *model.AddressBook) error {
	return DB.Create(u).Error
}

func (s *AddressBookService) Delete(u *model.AddressBook) error {
	return DB.Delete(u).Error
}

// Update 更新
func (s *AddressBookService) Update(u *model.AddressBook) error {
	return DB.Model(u).Updates(u).Error
}

// UpdateByMap 更新
func (s *AddressBookService) UpdateByMap(u *model.AddressBook, data map[string]interface{}) error {
	return DB.Model(u).Updates(data).Error
}

// UpdateAll 更新
func (s *AddressBookService) UpdateAll(u *model.AddressBook) error {
	return DB.Model(u).Select("*").Omit("created_at").Updates(u).Error
}

// PlatformFromOs
func (s *AddressBookService) PlatformFromOs(os string) string {
	if strings.Contains(os, "Android") || strings.Contains(os, "android") {
		return "Android"
	}
	if strings.Contains(os, "Windows") || strings.Contains(os, "windows") {
		return "Windows"
	}
	if strings.Contains(os, "Linux") || strings.Contains(os, "linux") {
		return "Linux"
	}
	if strings.Contains(os, "mac") || strings.Contains(os, "Mac") {
		return "Mac OS"
	}
	return ""
}

func (s *AddressBookService) ListByUserIdAndCollectionId(userId, cid, page, pageSize uint) (res *model.AddressBookList) {
	res = s.List(page, pageSize, func(tx *gorm.DB) {
		tx.Where("user_id = ? and collection_id = ?", userId, cid)
	})
	return
}

func (s *AddressBookService) CheckUserReadPrivilege(user *model.User, uid, cid uint) bool {
	return user.Id == uid
}

func (s *AddressBookService) CheckUserWritePrivilege(user *model.User, uid, cid uint) bool {
	return user.Id == uid
}

func (s *AddressBookService) CheckUserFullControlPrivilege(user *model.User, uid, cid uint) bool {
	return user.Id == uid
}

func (s *AddressBookService) BatchUpdateTags(abs []*model.AddressBook, tags []string) error {
	ids := make([]uint, 0)
	for _, ab := range abs {
		ids = append(ids, ab.RowId)
	}
	tagsv, _ := json.Marshal(tags)
	return DB.Model(&model.AddressBook{}).Where("row_id in ?", ids).Update("tags", tagsv).Error
}
