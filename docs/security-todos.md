# 安全待验证清单（audit run-1）

审计基线：`1006f0544a163d218e68c8da2e5c1933f2e640bb`。完整报告在 `.security-audit/run-1/`（本地审计产物，不入库）。
本清单收录 10 条 **待验证（needs-validation）** 线索：它们都有源码依据，但结论依赖一个部署/托管/浏览器事实，因此不分配严重级别。

状态说明：**已修复** = 当前工作区代码已消除该路径；**已缓解** = 主要放大/滥用路径已被限制，但仍需核实部署侧事实；**未修复** = 需要产品决策或仓库外资料。

| # | 条目 | 状态 | 仍需核实的事实 |
|---|---|---|---|
| 1 | 匿名 OAuth 状态缓存无上限保留 | 已缓解 | 反代请求体/连接限制、容器内存与 OOM 策略 |
| 2 | 认证前 JWT 解析分配放大（GO-2025-3553） | 已修复 | 发布后确认 `jwt.key` 配置与依赖版本 |
| 3 | 监听器缺少读/写/空闲/头超时 | 已修复 | 反代超时与公网可达性 |
| 4 | 匿名 OAuth 回调重放放大外部请求 | 已缓解 | GitHub 应用限流/滥用策略、入口限流 |
| 5 | 匿名 `/api/sysinfo` 持久行无限增长 | 已缓解 | 数据库容量/备份增长与入口限流 |
| 6 | 畸形带凭据代理 URL 写入日志 | 已修复 | 部署代理配置与日志读取范围 |
| 7 | OAuth state 未绑定轮询客户端 | 未修复 | GitHub 授权/自动批准行为、产品决策 |
| 8 | 管理台缺少防框架头（clickjacking） | 已修复 | 反代是否覆盖/补充响应头 |
| 9 | 发布工作流对可变第三方引用授予写权限 | 已缓解 | 托管 token 策略、tag/environment 保护 |
| 10 | 构建工具链/基础镜像未固定摘要 | 未修复 | 工具链分发方与镜像发布方的可信度 |

## 逐项说明与核实方式

### 1. 匿名 OAuth 状态缓存保留
- 代码：`service/oauth.go`（缓存上限 1000、字段长度 512/32、删除计数）、`http/http.go`（8 MiB 请求体上限、限流）。
- 核实：记录反代 `client_max_body_size`、连接/速率限制；容器 cgroup 内存与 OOM 策略；确认 GitHub OAuth 已配置。
- 通过标准：在正常入口限制下，匿名请求无法造成进程级内存耗尽；OAuth 状态缓存条目数不超过上限。

### 2. 认证前 JWT 分配放大
- 已升级 `github.com/golang-jwt/jwt/v5` 至 v5.2.2（修复 GO-2025-3553），并固定 HS256、增加头/超时限制。
- 核实：发布说明包含依赖版本；部署确认 `jwt.key` 是否配置（为空时该分支不执行）。
- 通过标准：dotted Authorization 不再触发 `ParseUnverified` 的 dot-split 放大；压力下内存稳定。

### 3. 监听器超时
- 已设置 `ReadHeaderTimeout=10s`、`ReadTimeout=30s`、`WriteTimeout=180s`、`IdleTimeout=120s`、`MaxHeaderBytes=1 MiB`。
- 核实：反代 `client_header_timeout`/`read_timeout`/`send_timeout` 与连接上限；21114 不直接暴露公网。
- 通过标准：半开连接在有限时间内被关闭；进程 fd/goroutine 不随空闲连接无界增长。

### 4. OAuth 回调重放与外部请求放大
- 已改为状态单次消费（空 code、已完成登录态、交换失败均删除）、请求上下文贯通、交换后关闭空闲连接；入口有限流。
- 核实：GitHub OAuth App 的 rate limit/abuse 行为；反代对四个回调别名的限流。
- 通过标准：同一 state 的第二次回调不再触发外部交换；失败回调不进入 GitHub 配额放大循环。

### 5. 匿名 sysinfo 行增长
- 已加 8 MiB 全局请求体上限、Peer 字段长度上限、`/api/sysinfo` 300 次/分/IP 限流。
- 核实：数据库容量/备份大小趋势、磁盘配额、入口体积限制。
- 通过标准：匿名报告无法在单 IP 预算内造成明显磁盘增长；`peers` 表增长可监控。

### 6. 代理凭据日志
- 已修复：`url.Parse` 错误不再携带原始 URL；告警改为固定文本；错误返回值不含凭据。
- 核实：部署的 `proxy.host`/`*_PROXY` 是否含凭据且格式正确；日志读取范围与保留策略。
- 通过标准：任何日志/错误响应中都不出现代理 userinfo。

### 7. OAuth state 与轮询客户端绑定
- 未修复，需产品决策。跟踪：<https://github.com/devcxl/rustdesk-api/issues/29>
- 核实：GitHub 对已授权应用的自动批准行为；是否要求 Owner 通过可信客户端发起。
- 通过标准：未持有发起方凭据的第三方无法兑换已完成授权的 state，且桌面端流程仍可用。

### 8. 管理台防框架
- 已修复：全局 `X-Frame-Options: DENY`、`CSP frame-ancestors 'none'`、`nosniff`、`Referrer-Policy`。
- 核实：反代是否覆盖/追加这些头；若反代设置 CSP，需合并 `frame-ancestors`。
- 通过标准：`/_admin/` 与 OAuth 结果页在跨源 iframe 中被拒绝。

### 9. 发布工作流写权限
- 已缓解：每 job 最小权限、`persist-credentials: false`、Docker 仅标签发布、SHA-256 校验和、provenance。
- 未完成：action 仍未固定到 SHA；托管 tag/environment 保护需在 GitHub 设置。跟踪：<https://github.com/devcxl/rustdesk-api/issues/30>
- 通过标准：所有 `uses:` 为 40 位 SHA；发布 job 需要受保护 ref/环境；token 权限与 job 匹配。

### 10. 构建工具链/基础镜像摘要
- 未修复：musl 工具链仍按 URL 下载且无校验；基础镜像使用浮动 tag。跟踪：<https://github.com/devcxl/rustdesk-api/issues/31>
- 核实：`musl.ljw.red` 是否为 Owner 控制；镜像 tag 的发布方可信度。
- 通过标准：工具链与基础镜像均以 SHA-256/digest 固定并在构建时校验。

## 其他跟踪事项（非 needs-validation）

- #32 管理端 CRUD Owner 过滤与遗留非 Owner 令牌
- #33 OAuth 绑定流程加固（BindConfirm / op / verified email）
- #34 管理台 `id` 与 `row_id` 字段不匹配（功能缺陷）
- #35 开发镜像 `COPY . .` 可能打包本地 conf 密钥
- #36 仓库内测试 RSA 私钥改为运行时生成
- #37 统一令牌过期语义并增加会话绝对上限
- #38 处理已失效的 LoginLimiter 与验证码死代码

## 复核命令

```bash
GOPROXY=off GOFLAGS=-mod=readonly go test ./... -count=1
GOOS=windows GOPROXY=off GOFLAGS=-mod=readonly go build ./cmd/... ./http/... ./lib/... ./service/...
cd admin && pnpm build
```
