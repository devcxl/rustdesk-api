package service

import (
	"errors"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/utils"
	"gorm.io/gorm"
)

const DefaultOwnerUserId = 1

type UserService struct {
}

// GetOwner 获取当前系统的 Owner 用户 (首位 Admin)
func (us *UserService) GetOwner() *model.User {
	u := &model.User{}
	isAdmin := true
	if err := DB.Where("is_admin = ?", &isAdmin).Order("id asc").First(u).Error; err == nil && u.Id > 0 {
		return u
	}
	return us.InfoById(DefaultOwnerUserId)
}

// GetOwnerId 获取当前系统 Owner 的 ID
func (us *UserService) GetOwnerId() uint {
	u := us.GetOwner()
	if u != nil && u.Id > 0 {
		return u.Id
	}
	return DefaultOwnerUserId
}

// InfoById 根据用户id取用户信息
func (us *UserService) InfoById(id uint) *model.User {
	u := &model.User{}
	DB.Where("id = ?", id).First(u)
	return u
}

// InfoByUsername 根据用户名取用户信息
func (us *UserService) InfoByUsername(un string) *model.User {
	u := &model.User{}
	DB.Where("username = ?", un).First(u)
	return u
}

// InfoByEmail 根据邮箱取用户信息
func (us *UserService) InfoByEmail(email string) *model.User {
	u := &model.User{}
	DB.Where("email = ?", email).First(u)
	return u
}

// InfoByOpenid 根据openid取用户信息
func (us *UserService) InfoByOpenid(openid string) *model.User {
	u := &model.User{}
	DB.Where("openid = ?", openid).First(u)
	return u
}

// InfoByAccessToken 根据accesstoken取用户信息
func (us *UserService) InfoByAccessToken(token string) (*model.User, *model.UserToken) {
	u := &model.User{}
	ut := &model.UserToken{}
	DB.Where("token = ?", token).First(ut)
	if ut.Id == 0 {
		return u, ut
	}
	if ut.ExpiredAt < time.Now().Unix() {
		return u, ut
	}
	DB.Where("id = ?", ut.UserId).First(u)
	return u, ut
}

// GenerateToken 生成token
func (us *UserService) GenerateToken(u *model.User) string {
	if len(Jwt.Key) > 0 {
		return Jwt.GenerateToken(u.Id)
	}
	return utils.Md5(u.Username + time.Now().String())
}

type LoginParams struct {
	DeviceUuid string
	DeviceId   string
	Client     string
	Platform   string
	Ip         string
}

// Login 登录
func (us *UserService) Login(u *model.User, p *LoginParams) *model.UserToken {
	token := us.GenerateToken(u)
	var uuid, devId string
	if p != nil {
		uuid = p.DeviceUuid
		devId = p.DeviceId
	}
	ut := &model.UserToken{
		UserId:     u.Id,
		Token:      token,
		DeviceUuid: uuid,
		DeviceId:   devId,
		ExpiredAt:  us.UserTokenExpireTimestamp(),
	}
	DB.Create(ut)
	if uuid != "" {
		AllService.PeerService.UuidBindUserId(devId, uuid, u.Id)
	}
	return ut
}

// CurUser 获取当前用户
func (us *UserService) CurUser(c *gin.Context) *model.User {
	user, _ := c.Get("curUser")
	u, ok := user.(*model.User)
	if !ok {
		return nil
	}
	return u
}

func (us *UserService) List(page, pageSize uint, where func(tx *gorm.DB)) (res *model.UserList) {
	res = &model.UserList{}
	res.Page = int64(page)
	res.PageSize = int64(pageSize)
	tx := DB.Model(&model.User{})
	if where != nil {
		where(tx)
	}
	tx.Count(&res.Total)
	tx.Scopes(Paginate(page, pageSize))
	tx.Find(&res.Users)
	return
}

// CheckUserEnable 判断用户是否可用
func (us *UserService) CheckUserEnable(u *model.User) bool {
	return u.Status == model.COMMON_STATUS_ENABLE
}

// Create 创建用户
func (us *UserService) Create(u *model.User) error {
	if us.IsUsernameExists(u.Username) {
		return errors.New("UsernameExists")
	}
	u.Username = us.formatUsername(u.Username)
	var err error
	u.Password, err = utils.EncryptPassword(u.Password)
	if err != nil {
		return err
	}
	return DB.Create(u).Error
}

// GetUuidByToken 根据token和user取uuid
func (us *UserService) GetUuidByToken(u *model.User, token string) string {
	ut := &model.UserToken{}
	err := DB.Where("user_id = ? and token = ?", u.Id, token).First(ut).Error
	if err != nil {
		return ""
	}
	return ut.DeviceUuid
}

// Logout 退出登录 -> 删除token, 解绑uuid
func (us *UserService) Logout(u *model.User, token string) error {
	uuid := us.GetUuidByToken(u, token)
	err := DB.Where("user_id = ? and token = ?", u.Id, token).Delete(&model.UserToken{}).Error
	if err != nil {
		return err
	}
	if uuid != "" {
		AllService.PeerService.UuidUnbindUserId(uuid, u.Id)
	}
	return nil
}

// Update 更新
func (us *UserService) Update(u *model.User) error {
	return DB.Model(u).Updates(u).Error
}

// FlushToken 清空token
func (us *UserService) FlushToken(u *model.User) error {
	return DB.Where("user_id = ?", u.Id).Delete(&model.UserToken{}).Error
}

// FlushTokenByUuid 清空token
func (us *UserService) FlushTokenByUuid(uuid string) error {
	return DB.Where("device_uuid = ?", uuid).Delete(&model.UserToken{}).Error
}

// FlushTokenByUuids 清空一组设备的 token
func (us *UserService) FlushTokenByUuids(uuids []string) error {
	return DB.Where("device_uuid in (?)", uuids).Delete(&model.UserToken{}).Error
}

// UpdatePassword 更新密码
func (us *UserService) UpdatePassword(u *model.User, password string) error {
	var err error
	u.Password, err = utils.EncryptPassword(password)
	if err != nil {
		return err
	}
	err = DB.Model(u).Update("password", u.Password).Error
	if err != nil {
		return err
	}
	return us.FlushToken(u)
}

// IsAdmin 是否管理员
func (us *UserService) IsAdmin(u *model.User) bool {
	return u != nil && *u.IsAdmin
}

// EnsureGithubAdmin 引导配置授权管理员
func (us *UserService) EnsureGithubAdmin(op, githubLogin string, u *model.User) *model.User {
	if op != model.OauthTypeGithub || u == nil || u.Id == 0 || us.IsAdmin(u) {
		return u
	}
	if !isAdminListed(Config.GithubOauth.Admins, githubLogin) {
		return u
	}
	if err := DB.Model(u).Update("is_admin", true).Error; err != nil {
		if Logger != nil {
			Logger.Warnf("grant admin to github user %s failed: %v", githubLogin, err)
		}
		return u
	}
	isAdmin := true
	u.IsAdmin = &isAdmin
	if Logger != nil {
		Logger.Infof("github user %s granted admin by config", githubLogin)
	}
	return u
}

// RouteNames 获取路由名称
func (us *UserService) RouteNames(u *model.User) []string {
	return model.AdminRouteNames
}

// InfoByOauthId 根据oauth的name和openId取用户信息
func (us *UserService) InfoByOauthId(op string, openId string) *model.User {
	ut := AllService.OauthService.UserThirdInfo(op, openId)
	if ut.Id == 0 {
		return nil
	}
	u := us.InfoById(ut.UserId)
	if u.Id == 0 {
		return nil
	}
	return u
}

// RegisterByOauth 通过 OAuth 关联或创建账号
func (us *UserService) RegisterByOauth(oauthUser *model.OauthUser, op string) (error, *model.User) {
	Lock.Lock("registerByOauth")
	defer Lock.UnLock("registerByOauth")

	ut := AllService.OauthService.UserThirdInfo(op, oauthUser.OpenId)
	if ut.Id != 0 {
		return nil, us.InfoById(ut.UserId)
	}
	err, oauthType := AllService.OauthService.GetTypeByOp(op)
	if err != nil {
		return err, nil
	}

	email := oauthUser.Email
	if email != "" {
		email = strings.ToLower(email)
		oauthUser.Email = email
		user := us.InfoByEmail(email)
		if user.Id != 0 {
			ut.FromOauthUser(user.Id, oauthUser, oauthType, op)
			DB.Create(ut)
			return nil, user
		}
	}

	tx := DB.Begin()
	ut = &model.UserThird{}
	ut.FromOauthUser(0, oauthUser, oauthType, op)
	username := us.formatUsername(oauthUser.Username)
	usernameUnique := us.GenerateUsernameByOauth(username)
	isAdmin := true
	user := &model.User{
		Username: usernameUnique,
		GroupId:  1,
		IsAdmin:  &isAdmin,
	}
	oauthUser.ToUser(user, false)
	tx.Create(user)
	if user.Id == 0 {
		tx.Rollback()
		return errors.New("OauthRegisterFailed"), user
	}
	ut.UserId = user.Id
	tx.Create(ut)
	tx.Commit()
	return nil, user
}

// GenerateUsernameByOauth 生成用户名
func (us *UserService) GenerateUsernameByOauth(name string) string {
	for us.IsUsernameExists(name) {
		name += strconv.Itoa(rand.Intn(10))
	}
	return name
}

// UserThirdsByUserId
func (us *UserService) UserThirdsByUserId(userId uint) (res []*model.UserThird) {
	DB.Where("user_id = ?", userId).Find(&res)
	return res
}

func (us *UserService) UserThirdInfo(userId uint, op string) *model.UserThird {
	ut := &model.UserThird{}
	DB.Where("user_id = ? and op = ?", userId, op).First(ut)
	return ut
}

// IsPasswordEmptyById 根据用户id判断密码是否为空
func (us *UserService) IsPasswordEmptyById(id uint) bool {
	u := &model.User{}
	if DB.Where("id = ?", id).First(u).Error != nil {
		return false
	}
	return u.Password == ""
}

// IsPasswordEmptyByUser 判断密码是否为空
func (us *UserService) IsPasswordEmptyByUser(u *model.User) bool {
	return us.IsPasswordEmptyById(u.Id)
}

func (us *UserService) formatUsername(username string) string {
	username = strings.ReplaceAll(username, " ", "")
	username = strings.ToLower(username)
	return username
}

// UserTokenExpireTimestamp 生成用户token过期时间
func (us *UserService) UserTokenExpireTimestamp() int64 {
	exp := Config.App.TokenExpire
	if exp == 0 {
		exp = 7 * 24 * time.Hour
	}
	return time.Now().Add(exp).Unix()
}

func (us *UserService) RefreshAccessToken(ut *model.UserToken) {
	ut.ExpiredAt = us.UserTokenExpireTimestamp()
	DB.Model(ut).Update("expired_at", ut.ExpiredAt)
}

func (us *UserService) AutoRefreshAccessToken(ut *model.UserToken) {
	if ut.ExpiredAt-time.Now().Unix() < Config.App.TokenExpire.Milliseconds()/3000 {
		us.RefreshAccessToken(ut)
	}
}

func (us *UserService) VerifyJWT(token string) (uint, error) {
	return Jwt.ParseToken(token)
}

// IsUsernameExists 判断用户名是否存在
func (us *UserService) IsUsernameExists(username string) bool {
	return us.IsUsernameExistsLocal(username)
}

func (us *UserService) IsUsernameExistsLocal(username string) bool {
	u := &model.User{}
	DB.Where("username = ?", username).First(u)
	return u.Id != 0
}
