# RustDesk API (Self-Hosted Single User)

[English Doc](README_EN.md)

专为**个人自建（Self-Hosted Single User）**打造的 RustDesk API 服务端。全面剔除多租户、复杂分组与冗余审计开销，收敛为仅通过 **GitHub OAuth2** 安全授权登录，并搭配全新的 **React + Tailwind CSS + Shadcn/ui** 现代化控制面板。

<div align="center">

![Dashboard Preview](docs/pc_login.png)

</div>

---

## 核心特性

- **个人单用户模式 (Self-Hosted Single User)**
  - 彻底清理多租户、用户组、设备组、分享链接等复杂逻辑，专注个人及私有节点管理。
  - 数据库表结构从 17 张压减至核心 9 张，轻量、安全、高效。
- **纯粹安全的登录体系 (GitHub OAuth2)**
  - 彻底收敛登录方式为 GitHub OAuth2，杜绝弱密码暴露风险。
  - 支持通过环境变量（如 `ALLOWED_USERS`）精准控制允许登录的 GitHub 用户名。
  - 授权白名单用户首次登录自动确立为系统唯一管理员 (Owner)。
- **全新重构的 Web 管理后台 (Shadcn/ui)**
  - 采用 **React 19 + TypeScript + Tailwind CSS v4 + Shadcn/ui** 原生无障碍规范完全重写。
  - 完整的暗黑模式（Dark Mode）与亮色模式支持。
  - **仪表盘 (Dashboard)**：RustDesk 服务端参数展示与一键复制、客户端配置字符串生成、活跃设备一览。
  - **受控设备 (Peers)**：实时在线呼吸灯、操作系统标识、别名编辑、硬件详情查看、一键导入地址簿、批量删除。
  - **地址簿 (Address Book)**：双向同步、密码显隐与一键复制、关联色彩标签徽章、条目增删改查。
  - **标签管理 (Tags)**：精选高雅调色板预设、标签实时预览与维护。
- **全端协议 100% 兼容**
  - 兼容官方 RustDesk 客户端（桌面端、移动端及 Web 客户端）。
  - 连接审计与文件审计接口静默响应 `200 Success`，零数据库存储负担，保障客户端平稳运行。

---

## 快速上手

### 1. 准备 GitHub OAuth App

1. 前往 GitHub Settings -> Developer settings -> [OAuth Apps](https://github.com/settings/developers) -> **New OAuth App**。
2. 填写应用信息：
   - **Homepage URL**: `https://your-domain.com` (或 `http://your-ip:21114`)
   - **Authorization callback URL**: `https://your-domain.com/api/oidc/callback`
3. 创建后获取 **Client ID** 并生成 **Client Secret**。

---

### 2. 使用 Docker Compose 部署

创建 `docker-compose.yaml`：

```yaml
services:
  rustdesk-api:
    image: ghcr.io/devcxl/rustdesk-api:latest
    container_name: rustdesk-api
    restart: unless-stopped
    ports:
      - "21114:21114"
    volumes:
      - ./data:/app/data
    environment:
      # 必填：GitHub OAuth 凭证
      - RUSTDESK_API_GITHUB_OAUTH_CLIENT_ID=your_github_client_id
      - RUSTDESK_API_GITHUB_OAUTH_CLIENT_SECRET=your_github_client_secret
      
      # 必填：允许登录的 GitHub 用户名白名单（支持逗号分隔多个账号）
      - ALLOWED_USERS=your-github-username
      
      # 选填：RustDesk 中继服务参数（自动推送到客户端和后台仪表盘）
      - RUSTDESK_API_RUSTDESK_ID_SERVER=1.2.3.4:21116
      - RUSTDESK_API_RUSTDESK_RELAY_SERVER=1.2.3.4:21117
      - RUSTDESK_API_RUSTDESK_KEY=your_public_key
      - RUSTDESK_API_RUSTDESK_API_SERVER=http://1.2.3.4:21114
```

启动服务：
```bash
docker compose up -d
```

打开浏览器访问 `http://your-ip:21114/_admin`，点击使用 GitHub 账号登录即可进入全新的 Shadcn/ui 控制面板。

---

## 常用环境变量说明

| 环境变量名 | 说明 | 示例 |
| :--- | :--- | :--- |
| `ALLOWED_USERS` | 允许登录的 GitHub 用户名白名单（推荐） | `my-github-account` |
| `RUSTDESK_API_GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth 应用 Client ID | `Ov23li...` |
| `RUSTDESK_API_GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth 应用 Client Secret | `6789abcd...` |
| `RUSTDESK_API_RUSTDESK_ID_SERVER` | RustDesk ID 服务器地址与端口 | `rustdesk.example.com:21116` |
| `RUSTDESK_API_RUSTDESK_RELAY_SERVER` | RustDesk 中继服务器地址与端口 | `rustdesk.example.com:21117` |
| `RUSTDESK_API_RUSTDESK_KEY` | 服务端公钥 Key 内容（与 KEY_FILE 二选一） | `rU5tD3sK...=` |
| `RUSTDESK_API_RUSTDESK_KEY_FILE` | 公钥文件路径（支持 Docker 挂载自动读取，支持短别名 `KEY_FILE`） | `/app/data/id_ed25519.pub` |
| `SOCKS5_PROXY` | SOCKS5 代理地址（解决国内服务器访问 GitHub OAuth 超时，支持 `ALL_PROXY`） | `socks5://192.168.1.100:1080` |
| `HTTP_PROXY` | HTTP 代理地址（支持标准 `http_proxy`、`https_proxy`） | `http://192.168.1.100:7890` |
| `RUSTDESK_API_RUSTDESK_API_SERVER` | API 服务器地址（可选，默认当前主机） | `https://api.example.com` |

---

## 本地编译与开发

### 依赖环境
- Go 1.23+
- Node.js 22+ & pnpm 11.x

### 编译运行
```bash
# 1. 编译前端管理面板
cd admin
pnpm install --frozen-lockfile
pnpm build
cd ..

# 2. 编译运行 Go 后端服务
go run cmd/apimain.go
```

或直接执行自动化打包脚本：
```bash
./build.sh
```
Windows 可运行 `build.bat`。两个打包脚本都会先用 pnpm 11 构建管理后台；`resources/admin/` 是生成目录，不需要提交到 Git。

---

## License

[Apache-2.0 License](LICENSE)
