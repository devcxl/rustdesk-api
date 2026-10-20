package config

import (
	"os"
	"strings"
)

const (
	DefaultIdServerPort    = 21116
	DefaultRelayServerPort = 21117
)

type Rustdesk struct {
	IdServer        string `mapstructure:"id-server"`
	IdServerPort    int    `mapstructure:"-"`
	RelayServer     string `mapstructure:"relay-server"`
	RelayServerPort int    `mapstructure:"-"`
	ApiServer       string `mapstructure:"api-server"`
	Key             string `mapstructure:"key"`
	KeyFile         string `mapstructure:"key-file"`
	Personal        int    `mapstructure:"personal"`
}

func (rd *Rustdesk) LoadKeyFile() {
	rd.Key = strings.TrimSpace(rd.Key)
	if rd.Key != "" {
		return
	}

	// 候选文件路径
	candidates := []string{}
	if rd.KeyFile != "" {
		candidates = append(candidates, rd.KeyFile)
	}
	for _, envKey := range []string{"RUSTDESK_API_RUSTDESK_KEY_FILE", "KEY_FILE", "RUSTDESK_KEY_FILE"} {
		if val := strings.TrimSpace(os.Getenv(envKey)); val != "" {
			candidates = append(candidates, val)
		}
	}
	// 默认探测路径（如 Docker 挂载数据卷）
	candidates = append(candidates, "./data/id_ed25519.pub", "/app/data/id_ed25519.pub", "data/id_ed25519.pub", "id_ed25519.pub")

	for _, path := range candidates {
		if b, err := os.ReadFile(path); err == nil {
			content := strings.TrimSpace(string(b))
			if content != "" {
				rd.Key = content
				rd.KeyFile = path
				return
			}
		}
	}
}
