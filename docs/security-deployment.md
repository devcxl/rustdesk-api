# 安全部署指南（反向代理 / TLS / 权限）

> 适用于裸机、systemd、deb 包与 Docker Compose 部署。改动 `systemd/`、`debian/`、`docker-compose*.yaml` 后必须重新部署才会生效，见文末。

## 1. 网络拓扑

```
Internet ──HTTPS(443)──> Nginx/Caddy ──HTTP(127.0.0.1:21114)──> rustdesk-api
```

- `21114` 是 Web 控制台/API 端口，**只允许**反向代理访问，不要直接映射到公网。
- 服务应绑定回环或内网：`gin.api-addr: "127.0.0.1:21114"`（默认 `0.0.0.0:21114` 会监听所有网卡）。
- Docker Compose 端口映射写成 `127.0.0.1:21114:21114`，不要写 `21114:21114`。
- RustDesk 客户端的 `rustdesk.api-server` 必须使用 HTTPS（如 `https://api.example.com`），且与反代域名一致；纯 HTTP 会以明文传输登录凭据和 token。

### 反向代理与客户端 IP

经反向代理时，把 `gin.trust-proxy` 设为代理地址（如 `127.0.0.1`），否则登录限流、封禁会按代理 IP 统计；
未部署代理时不要配置该项，也不要信任外部传入的 `X-Forwarded-For`。

## 2. Nginx 示例

```nginx
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:21114;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

如需 HSTS 等安全响应头，请按站点策略在 `server` 块中补充。

## 3. Caddy 示例（自动证书）

```caddyfile
api.example.com {
    reverse_proxy 127.0.0.1:21114
}
```

Caddy 自动签发/续期证书，并默认传递 `X-Forwarded-*`。

## 4. 账号与文件权限

- systemd 以专用账号 `rustdesk-api` 运行（`User=`/`Group=`），`UMask=0077`；不要改回 root，也不要关闭 `NoNewPrivileges`、`ProtectSystem` 等加固项。
- `/var/lib/rustdesk-api/data`、`/var/lib/rustdesk-api/runtime`、`/var/log/rustdesk-api` 归 `rustdesk-api` 所有，目录权限 `0750`。
- `conf/config.yaml` 为 `root:rustdesk-api 0640`：其中包含 RustDesk key、JWT key、OAuth client secret。
- SQLite 数据目录由程序收紧为 `0700`，已有库文件为 `0600`；日志文件 `0640`。
- RustDesk 密钥（`id_ed25519`、`id_ed25519.pub` 等）与 `.env` 已在 `.gitignore` / `.dockerignore` 中忽略，不要提交仓库或打进镜像；Compose 数据卷 `data/rustdesk/api/` 同样不纳入版本控制。
- Docker 部署时，如使用 `.env` 注入密钥，建议权限 `0600` 且仅运维账号可读。

## 5. 备份与恢复

备份对象：

- 数据库：SQLite 为 `/var/lib/rustdesk-api/data/rustdeskapi.db`（在线备份用 `sqlite3 rustdeskapi.db ".backup backup.db"`，或短暂停服后复制）；MySQL/PostgreSQL 使用各自备份工具。
- 配置：`conf/config.yaml`。
- RustDesk 密钥：`id_ed25519` / `id_ed25519.pub`（私钥丢失后需重新下发 key 给客户端）。

要求：

- 备份文件按与密钥同等级别保护（加密存储、限制访问），不要放入 Web 静态目录。
- 定期演练恢复；升级前先备份。

## 6. 变更如何生效

修改 `systemd/rustdesk-api.service`、`debian/*.postinst` 或 `docker-compose*.yaml` 后，仅改仓库文件不会影响已部署实例，必须重新部署：

```bash
# systemd / deb 包：重新安装 deb 包（postinst 会创建账号与目录权限）
sudo dpkg -i rustdesk-api-server_*.deb && sudo systemctl restart rustdesk-api
# 或手动生效
sudo systemctl daemon-reload && sudo systemctl restart rustdesk-api

# Docker Compose
docker compose up -d --force-recreate
```

只改 `conf/config.yaml` 时重启进程即可；只改反代配置时 reload Nginx/Caddy 即可。

## 7. 手动安装 systemd 单元的额外步骤

deb 包的 `postinst` 会自动创建账号与目录；如果你直接复制 `systemd/rustdesk-api.service` 到裸机：

```bash
sudo addgroup --system rustdesk-api
sudo adduser --system --ingroup rustdesk-api --home /var/lib/rustdesk-api \
  --no-create-home --disabled-login rustdesk-api
sudo mkdir -p /var/lib/rustdesk-api/data /var/lib/rustdesk-api/runtime /var/log/rustdesk-api
sudo chown -R rustdesk-api:rustdesk-api /var/lib/rustdesk-api/data /var/lib/rustdesk-api/runtime /var/log/rustdesk-api
sudo chmod 0750 /var/lib/rustdesk-api/data /var/lib/rustdesk-api/runtime /var/log/rustdesk-api
sudo chown root:rustdesk-api /var/lib/rustdesk-api/conf/config.yaml
sudo chmod 0640 /var/lib/rustdesk-api/conf/config.yaml
```

否则 `User=rustdesk-api` 会导致服务启动失败。

## 8. 请求边界与反代配合

- 进程内已限制：请求体 8 MiB；监听 `ReadHeaderTimeout=10s`、`ReadTimeout=30s`、`WriteTimeout=180s`、`IdleTimeout=120s`、`MaxHeaderBytes=1 MiB`。
- 匿名敏感路径有按 IP 的每分钟固定窗口预算：OIDC 发起 30、OIDC 轮询 120、OAuth/OIDC 回调 60、`/api/sysinfo` 300、`/api/heartbeat` 6000，其余 3000；超限返回 429。多实例部署时每实例独立计数。
- 反向代理的 `client_max_body_size` 建议不小于 8 MiB，并配置连接/读取超时，避免把无超时连接直接暴露给进程。
- `gin.trust-proxy` 必须与实际反代地址一致，否则按 IP 的限流与日志会记录代理地址。

## 9. 开发镜像、conf 挂载与测试密钥

- `.dockerignore` 已排除 `conf/`（与既有 `.env*`、`runtime/`、数据库及 `id_ed25519*` 规则并列），`Dockerfile.dev` 的构建上下文与最终镜像都不再包含本地 `conf/config.yaml`，避免把本地 OAuth/JWT/RustDesk 密钥打进开发镜像。
- 开发镜像运行时必须挂载配置目录：`docker-compose-dev.yaml` 已提供 `./conf:/app/conf`，请保持该挂载。缺少 `conf/config.yaml` 时进程会在启动时 panic（`Fatal error config file`）。
- 不要在不挂载 `conf/` 的情况下直接用 `docker run` 启动开发镜像；如确需单独运行，请显式挂载配置目录（`-v "$PWD/conf:/app/conf"`），并确保该目录包含 `config.yaml`。
- 发布镜像不受影响：发布流程由 `build.sh` 将 `conf/` 放入 `release/`，再由仓库根 `Dockerfile` 复制构建产物；`.dockerignore` 中的 `conf/` 只匹配构建上下文根目录，不会排除 `amd64/release/conf` 等嵌套路径。
- `lib/jwt` 测试使用源码中明确标注的非生产 HMAC 测试密钥，不得作为部署 `jwt.key`；仓库已移除历史 RSA 测试私钥，但旧提交中的密钥材料仍应视为已泄露、不可复用，如曾用于部署请轮换 `jwt.key`。
