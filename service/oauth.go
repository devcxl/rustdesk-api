package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/utils"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"gorm.io/gorm"
)

type OauthService struct {
}

type OauthCacheItem struct {
	UserId     uint   `json:"user_id"`
	Id         string `json:"id"`
	Op         string `json:"op"`
	Action     string `json:"action"`
	Uuid       string `json:"uuid"`
	DeviceName string `json:"device_name"`
	DeviceOs   string `json:"device_os"`
	DeviceType string `json:"device_type"`
	OpenId     string `json:"open_id"`
	Username   string `json:"username"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Verifier   string `json:"verifier"`
	Nonce      string `json:"nonce"`
}

func (oci *OauthCacheItem) ToOauthUser() *model.OauthUser {
	return &model.OauthUser{
		OpenId:   oci.OpenId,
		Username: oci.Username,
		Name:     oci.Name,
		Email:    oci.Email,
	}
}

var OauthCache = &sync.Map{}

// githubMembershipURLFmt GitHub 组织成员资格查询接口，测试时可替换为 httptest 地址
var githubMembershipURLFmt = "https://api.github.com/user/memberships/orgs/%s"

const (
	OauthActionTypeLogin = "login"
	OauthActionTypeBind  = "bind"
)

func (oci *OauthCacheItem) UpdateFromOauthUser(oauthUser *model.OauthUser) {
	oci.OpenId = oauthUser.OpenId
	oci.Username = oauthUser.Username
	oci.Name = oauthUser.Name
	oci.Email = oauthUser.Email
}

func (svc *OauthService) GetOauthCache(key string) *OauthCacheItem {
	v, ok := OauthCache.Load(key)
	if !ok {
		return nil
	}
	return v.(*OauthCacheItem)
}

func (svc *OauthService) SetOauthCache(key string, item *OauthCacheItem, expire uint) {
	OauthCache.Store(key, item)
	if expire > 0 {
		time.AfterFunc(time.Duration(expire)*time.Second, func() {
			svc.DeleteOauthCache(key)
		})
	}
}

func (svc *OauthService) DeleteOauthCache(key string) {
	OauthCache.Delete(key)
}

// BeginAuth: Initiate OAuth authentication
func (svc *OauthService) BeginAuth(op string) (err error, state, verifier, nonce, url string) {
	err, _, oauthConfig, _ := svc.GetOauthConfig(op)
	if err != nil {
		return err, "", "", "", ""
	}

	state = utils.RandomString(32)
	verifier = utils.RandomString(43)
	nonce = utils.RandomString(32)

	extras := []oauth2.AuthCodeOption{
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.S256ChallengeOption(verifier),
	}

	return nil, state, verifier, nonce, oauthConfig.AuthCodeURL(state, extras...)
}

func (svc *OauthService) GithubProvider() *oidc.Provider {
	return (&oidc.ProviderConfig{
		IssuerURL:     "",
		AuthURL:       github.Endpoint.AuthURL,
		TokenURL:      github.Endpoint.TokenURL,
		DeviceAuthURL: github.Endpoint.DeviceAuthURL,
		UserInfoURL:   model.UserEndpointGithub,
		JWKSURL:       "",
		Algorithms:    nil,
	}).NewProvider(context.Background())
}

// GetOauthConfig 获取 GitHub OAuth2 配置
func (svc *OauthService) GetOauthConfig(op string) (err error, oauthInfo *model.Oauth, oauthConfig *oauth2.Config, provider *oidc.Provider) {
	oauthInfo = svc.InfoByOp(model.OauthTypeGithub)
	if oauthInfo.Id == 0 || oauthInfo.ClientId == "" || oauthInfo.ClientSecret == "" {
		return errors.New("ConfigNotFound"), nil, nil, nil
	}
	oauthConfig = &oauth2.Config{
		ClientID:     oauthInfo.ClientId,
		ClientSecret: oauthInfo.ClientSecret,
		RedirectURL:  Config.Rustdesk.ApiServer + "/api/oidc/callback",
		Endpoint:     github.Endpoint,
		Scopes:       []string{"read:user", "user:email"},
	}
	provider = svc.GithubProvider()
	return nil, oauthInfo, oauthConfig, provider
}

// GetConfiguredProxyURL 智能读取环境变量或配置中的代理地址，支持 SOCKS5 / HTTP / HTTPS
func GetConfiguredProxyURL() (*url.URL, error) {
	var raw string
	if Config != nil && Config.Proxy.Host != "" {
		raw = Config.Proxy.Host
	}

	// 环境变量优先检测（支持各类常见大小写拼写）
	candidates := []string{
		"SOCKS5_PROXY", "socks5_proxy",
		"SOCKS_PROXY", "socks_proxy",
		"ALL_PROXY", "all_proxy",
		"HTTP_PROXY", "http_proxy",
		"HTTPS_PROXY", "https_proxy",
		"RUSTDESK_API_PROXY_HOST",
		"PROXY_URL", "PROXY_HOST",
	}
	for _, envKey := range candidates {
		if val := strings.TrimSpace(os.Getenv(envKey)); val != "" {
			raw = val
			break
		}
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	// 格式归一化：若未包含 scheme 则默认作为 socks5:// 协议解析
	if strings.HasPrefix(raw, "socks://") {
		raw = "socks5://" + strings.TrimPrefix(raw, "socks://")
	} else if !strings.Contains(raw, "://") {
		raw = "socks5://" + raw
	}

	return url.Parse(raw)
}

func getHTTPClientWithProxy() *http.Client {
	timeout := 60 * time.Second
	proxyURL, err := GetConfiguredProxyURL()
	if err != nil {
		if Logger != nil {
			Logger.Warn("Invalid proxy configuration: ", err)
		}
	}

	var transport *http.Transport
	if proxyURL != nil {
		if Logger != nil {
			Logger.Infof("Using proxy for GitHub OAuth requests: %s", proxyURL.Redacted())
		}
		transport = &http.Transport{
			Proxy: http.ProxyURL(proxyURL),
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		}
	} else {
		// 回退读取系统环境默认代理
		transport = &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		}
	}

	return &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}
}

func (svc *OauthService) callbackBase(oauthConfig *oauth2.Config, provider *oidc.Provider, code string, verifier string, nonce string, userData interface{}) (err error, client *http.Client) {
	httpClient := getHTTPClientWithProxy()
	ctx := context.WithValue(context.Background(), oauth2.HTTPClient, httpClient)

	exchangeOpts := make([]oauth2.AuthCodeOption, 0, 1)
	if verifier != "" {
		exchangeOpts = append(exchangeOpts, oauth2.VerifierOption(verifier))
	}

	token, err := oauthConfig.Exchange(ctx, code, exchangeOpts...)
	if err != nil {
		if Logger != nil {
			Logger.Warn("oauthConfig.Exchange() failed: ", err)
		}
		return errors.New("GetOauthTokenError"), nil
	}

	client = oauthConfig.Client(ctx, token)
	resp, err := client.Get(provider.UserInfoEndpoint())
	if err != nil {
		if Logger != nil {
			Logger.Warn("failed getting user info: ", err)
		}
		return errors.New("GetOauthUserInfoError"), nil
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil && Logger != nil {
			Logger.Warn("failed closing response body: ", closeErr)
		}
	}()

	if err = json.NewDecoder(resp.Body).Decode(userData); err != nil {
		if Logger != nil {
			Logger.Warn("failed decoding user info: ", err)
		}
		return errors.New("DecodeOauthUserInfoError"), nil
	}

	return nil, client
}

// githubCallback github 回调处理
func (svc *OauthService) githubCallback(oauthConfig *oauth2.Config, provider *oidc.Provider, code, verifier, nonce string) (error, *model.OauthUser) {
	var user = &model.GithubUser{}
	err, client := svc.callbackBase(oauthConfig, provider, code, verifier, nonce, user)
	if err != nil {
		return err, nil
	}
	// 校验 GitHub 登录名是否在允许列表中
	if err := svc.checkGithubAccess(client, user.Login); err != nil {
		return err, nil
	}
	err = svc.getGithubPrimaryEmail(client, user)
	if err != nil {
		return err, nil
	}
	return nil, user.ToOauthUser()
}

// splitCsv 拆分逗号分隔的配置项，去除空白项与首尾空格
func splitCsv(s string) []string {
	items := strings.Split(s, ",")
	res := make([]string, 0, len(items))
	for _, v := range items {
		v = strings.TrimSpace(v)
		if v != "" {
			res = append(res, v)
		}
	}
	return res
}

// isAdminListed 判断 GitHub 登录名是否命中 admins 白名单（大小写不敏感）
func isAdminListed(adminsCsv, login string) bool {
	for _, a := range splitCsv(adminsCsv) {
		if strings.EqualFold(a, login) {
			return true
		}
	}
	return false
}

// GetAllowedGithubUsers 获取环境变量或配置中允许登录的 GitHub 用户名列表
func (svc *OauthService) GetAllowedGithubUsers() []string {
	var sources []string
	// 支持多种常见环境变量名称
	envKeys := []string{
		"ALLOWED_USERS",
		"GITHUB_ALLOWED_USERS",
		"RUSTDESK_ALLOWED_USERS",
		"RUSTDESK_API_GITHUB_OAUTH_USERS",
	}
	for _, key := range envKeys {
		if val := os.Getenv(key); val != "" {
			sources = append(sources, val)
		}
	}
	if Config != nil && Config.GithubOauth.Users != "" {
		sources = append(sources, Config.GithubOauth.Users)
	}

	userMap := make(map[string]struct{})
	for _, src := range sources {
		for _, u := range splitCsv(src) {
			userMap[strings.ToLower(u)] = struct{}{}
		}
	}
	res := make([]string, 0, len(userMap))
	for u := range userMap {
		res = append(res, u)
	}
	return res
}

// checkGithubAccess 校验 GitHub 用户是否允许登录。
// 当环境变量或配置指定了可登录用户名时，强制进行白名单校验；
// 未指定用户时，若配置了组织则检查组织成员资格；其余情况按 RestrictEnable 策略控制。
func (svc *OauthService) checkGithubAccess(client *http.Client, login string) error {
	cfg := Config.GithubOauth
	allowedUsers := svc.GetAllowedGithubUsers()

	// 1. 如果通过环境变量或配置指定了可登录用户名，强制白名单拦截
	if len(allowedUsers) > 0 {
		for _, u := range allowedUsers {
			if strings.EqualFold(u, login) {
				return nil
			}
		}
		// 若部署者在 admins 中显式配置，亦允许通过
		if isAdminListed(cfg.Admins, login) {
			return nil
		}
		return errors.New("GithubAccessDenied")
	}

	// 2. 如果未指定具体用户，但配置了 admins 且命中，放行
	if isAdminListed(cfg.Admins, login) {
		return nil
	}

	// 3. 检查是否启用了限制
	if !cfg.RestrictEnable {
		return nil
	}

	// 4. 检查组织白名单
	for _, org := range splitCsv(cfg.Orgs) {
		resp, err := client.Get(fmt.Sprintf(githubMembershipURLFmt, url.PathEscape(org)))
		if err != nil {
			if Logger != nil {
				Logger.Warnf("check github org membership failed: %v", err)
			}
			continue
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			continue
		}
		var m struct {
			State string `json:"state"`
		}
		err = json.NewDecoder(resp.Body).Decode(&m)
		resp.Body.Close()
		if err == nil && m.State == "active" {
			return nil
		}
	}
	return errors.New("GithubAccessDenied")
}

// Callback: 通过授权码与 verifier 获取用户信息
func (svc *OauthService) Callback(code, verifier, op, nonce string) (err error, oauthUser *model.OauthUser) {
	err, _, oauthConfig, provider := svc.GetOauthConfig(op)
	if err != nil {
		return err, nil
	}
	return svc.githubCallback(oauthConfig, provider, code, verifier, nonce)
}

func (svc *OauthService) UserThirdInfo(op string, openId string) *model.UserThird {
	ut := &model.UserThird{}
	DB.Where("open_id = ? and op = ?", openId, op).First(ut)
	return ut
}

func (svc *OauthService) BindOauthUser(userId uint, oauthUser *model.OauthUser, op string) error {
	utr := &model.UserThird{}
	err, oauthType := svc.GetTypeByOp(op)
	if err != nil {
		return err
	}
	utr.FromOauthUser(userId, oauthUser, oauthType, op)
	return DB.Create(utr).Error
}

func (svc *OauthService) UnBindOauthUser(userId uint, op string) error {
	return svc.UnBindThird(op, userId)
}

func (svc *OauthService) UnBindThird(op string, userId uint) error {
	return DB.Where("user_id = ? and op = ?", userId, op).Delete(&model.UserThird{}).Error
}

func (svc *OauthService) DeleteUserByUserId(userId uint) error {
	return DB.Where("user_id = ?", userId).Delete(&model.UserThird{}).Error
}

func (svc *OauthService) InfoById(id uint) *model.Oauth {
	oauthInfo := &model.Oauth{}
	DB.Where("id = ?", id).First(oauthInfo)
	return oauthInfo
}

func (svc *OauthService) InfoByOp(op string) *model.Oauth {
	oauthInfo := &model.Oauth{}
	DB.Where("op = ?", op).First(oauthInfo)
	return oauthInfo
}

func (svc *OauthService) List(page, pageSize uint, where func(tx *gorm.DB)) (res *model.OauthList) {
	res = &model.OauthList{}
	res.Page = int64(page)
	res.PageSize = int64(pageSize)
	tx := DB.Model(&model.Oauth{})
	if where != nil {
		where(tx)
	}
	tx.Count(&res.Total)
	tx.Scopes(Paginate(page, pageSize))
	tx.Find(&res.Oauths)
	return
}

func (svc *OauthService) GetTypeByOp(op string) (error, string) {
	return nil, model.OauthTypeGithub
}

func (svc *OauthService) Create(oauthInfo *model.Oauth) error {
	oauthInfo.Op = model.OauthTypeGithub
	oauthInfo.OauthType = model.OauthTypeGithub
	return DB.Create(oauthInfo).Error
}

func (svc *OauthService) Update(oauthInfo *model.Oauth) error {
	return DB.Model(oauthInfo).Updates(oauthInfo).Error
}

// SeedGithubOauth 将配置与环境变量中的 GitHub OAuth App 凭据同步到数据库
func (svc *OauthService) SeedGithubOauth() error {
	c := Config.GithubOauth
	clientId := c.ClientId
	clientSecret := c.ClientSecret
	if envId := os.Getenv("RUSTDESK_API_GITHUB_OAUTH_CLIENT_ID"); envId != "" {
		clientId = envId
	}
	if envSecret := os.Getenv("RUSTDESK_API_GITHUB_OAUTH_CLIENT_SECRET"); envSecret != "" {
		clientSecret = envSecret
	}
	if clientId == "" || clientSecret == "" {
		return nil
	}
	oauthInfo := svc.InfoByOp(model.OauthTypeGithub)
	if oauthInfo.Id == 0 {
		autoRegister := true
		oauthInfo = &model.Oauth{
			Op:           model.OauthTypeGithub,
			OauthType:    model.OauthTypeGithub,
			ClientId:     clientId,
			ClientSecret: clientSecret,
			AutoRegister: &autoRegister,
		}
		if err := svc.Create(oauthInfo); err != nil {
			return err
		}
		if Logger != nil {
			Logger.Info("github oauth provider seeded from config/env")
		}
	} else if oauthInfo.ClientId != clientId || oauthInfo.ClientSecret != clientSecret {
		oauthInfo.ClientId = clientId
		oauthInfo.ClientSecret = clientSecret
		if err := svc.Update(oauthInfo); err != nil {
			return err
		}
		if Logger != nil {
			Logger.Info("github oauth provider credentials updated from config/env")
		}
	}
	return nil
}

// GetOauthProviders 获取启用的提供商列表 (单用户模式仅支持 GitHub)
func (svc *OauthService) GetOauthProviders() []string {
	return []string{model.OauthTypeGithub}
}

// getGithubPrimaryEmail 获取用户的主邮箱
func (svc *OauthService) getGithubPrimaryEmail(client *http.Client, githubUser *model.GithubUser) error {
	resp, err := client.Get("https://api.github.com/user/emails")
	if err != nil {
		return fmt.Errorf("failed to fetch emails: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch emails: %s", resp.Status)
	}

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	for _, e := range emails {
		if e.Primary && e.Verified {
			githubUser.Email = e.Email
			githubUser.VerifiedEmail = e.Verified
			return nil
		}
	}

	return nil
}
