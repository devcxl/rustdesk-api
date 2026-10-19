package config

import (
	"fmt"
	"github.com/spf13/viper"
	"strings"
	"time"
)

const (
	DebugMode     = "debug"
	ReleaseMode   = "release"
	DefaultConfig = "conf/config.yaml"
)

type App struct {
	WebClient        int           `mapstructure:"web-client"`
	Register         bool          `mapstructure:"register"`
	RegisterStatus   int           `mapstructure:"register-status"`
	ShowSwagger      int           `mapstructure:"show-swagger"`
	TokenExpire      time.Duration `mapstructure:"token-expire"`
	WebSso           bool          `mapstructure:"web-sso"`
	CaptchaThreshold int           `mapstructure:"captcha-threshold"`
	BanThreshold     int           `mapstructure:"ban-threshold"`
}
type Admin struct {
	Title           string `mapstructure:"title"`
	Hello           string `mapstructure:"hello"`
	HelloFile       string `mapstructure:"hello-file"`
	IdServerPort    int    `mapstructure:"id-server-port"`
	RelayServerPort int    `mapstructure:"relay-server-port"`
}

// GithubOauthAccess GitHub OAuth2 登录访问控制配置
// 仅允许配置的个人账号或指定组织的成员通过 GitHub OAuth2 登录
type GithubOauthAccess struct {
	RestrictEnable bool   `mapstructure:"restrict-enable"` // 是否启用白名单限制, 默认关闭
	Orgs           string `mapstructure:"orgs"`            // 允许的组织, 逗号分隔, 如 "acme-org,subsidiary"
	Users          string `mapstructure:"users"`           // 允许的个人 GitHub 登录名, 逗号分隔
	Admins         string `mapstructure:"admins"`          // 登录后自动授予管理员的 GitHub 登录名, 逗号分隔
	ClientId       string `mapstructure:"client-id"`       // GitHub OAuth App 凭据, 启动时自动种入数据库(解决新部署无登录入口的引导问题)
	ClientSecret   string `mapstructure:"client-secret"`   // 同上
}
type Config struct {
	Lang        string `mapstructure:"lang"`
	App         App
	Admin       Admin
	Gorm        Gorm
	Mysql       Mysql
	Postgresql  Postgresql
	Gin         Gin
	Logger      Logger
	Redis       Redis
	Cache       Cache
	Jwt         Jwt
	Rustdesk    Rustdesk
	Proxy       Proxy
	GithubOauth GithubOauthAccess `mapstructure:"github-oauth"`
}

func (a *Admin) Init() {
	if a.IdServerPort == 0 {
		a.IdServerPort = DefaultIdServerPort
	}
	if a.RelayServerPort == 0 {
		a.RelayServerPort = DefaultRelayServerPort
	}
}

// Init 初始化配置
func Init(rowVal *Config, path string) *viper.Viper {
	if path == "" {
		path = DefaultConfig
	}
	v := viper.GetViper()
	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_", "-", "_"))
	v.SetEnvPrefix("RUSTDESK_API")
	v.SetConfigFile(path)
	v.SetConfigType("yaml")
	err := v.ReadInConfig()
	if err != nil {
		panic(fmt.Errorf("Fatal error config file: %s \n", err))
	}
	/*
		v.WatchConfig()


			//监听配置修改没什么必要
			v.OnConfigChange(func(e fsnotify.Event) {
				//配置文件修改监听
				fmt.Println("config file changed:", e.Name)
				if err2 := v.Unmarshal(rowVal); err2 != nil {
					fmt.Println(err2)
				}
				rowVal.Rustdesk.LoadKeyFile()
				rowVal.Rustdesk.ParsePort()
			})
	*/
	if err := v.Unmarshal(rowVal); err != nil {
		panic(fmt.Errorf("Fatal error config: %s \n", err))
	}
	rowVal.Rustdesk.LoadKeyFile()
	rowVal.Admin.Init()
	return v
}

// ReadEnv 读取环境变量
func ReadEnv(rowVal interface{}) *viper.Viper {
	v := viper.New()
	v.AutomaticEnv()
	if err := v.Unmarshal(rowVal); err != nil {
		fmt.Println(err)
	}
	return v
}
