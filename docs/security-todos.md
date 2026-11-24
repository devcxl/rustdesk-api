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
| 7 | OAuth state 未绑定轮询客户端 | 已接受（C）+ 管理台浏览器绑定 | 桌面端 state-only 风险由 Owner 接受 |
| 8 | 管理台缺少防框架头（clickjacking） | 已修复 | 反代是否覆盖/补充响应头 |
| 9 | 发布工作流对可变第三方引用授予写权限 | 代码已修复；托管设置待开 | GitHub 仓库 tag/environment 保护、Dependabot alerts |
| 10 | 构建工具链/基础镜像未固定摘要 | 已修复（TOFU） | 后续通过 Dependabot 更新 digest |

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
- 决策：采用 **C（接受桌面端风险 + 文档/入口限制）**；ADR 状态已更新为 Accepted。
- 管理台登录已绑定发起浏览器的 HttpOnly cookie（`BrowserBinding`），回调与轮询兑换都校验；跨浏览器/攻击者发起的 state 无法兑换。
- 桌面客户端仍为 state-only；Owner 不应打开陌生授权链接。跟踪：<https://github.com/devcxl/rustdesk-api/issues/29>
- 核实：GitHub 对已授权应用的自动批准行为；是否要求 Owner 通过可信客户端发起。
- 通过标准：未持有发起方凭据的第三方无法兑换已完成授权的 state，且桌面端流程仍可用。

### 8. 管理台防框架
- 已修复：全局 `X-Frame-Options: DENY`、`CSP frame-ancestors 'none'`、`nosniff`、`Referrer-Policy`。
- 核实：反代是否覆盖/追加这些头；若反代设置 CSP，需合并 `frame-ancestors`。
- 通过标准：`/_admin/` 与 OAuth 结果页在跨源 iframe 中被拒绝。

### 9. 发布工作流写权限
- 已完成：每 job 最小权限、`persist-credentials: false`、Docker 仅标签发布、SHA-256 校验和、provenance，以及全部 action 固定到 40 位 commit SHA + govulncheck + Dependabot 配置。
- 仍需 Owner 在 GitHub 设置中开启 Dependabot alerts/security updates、tag/environment 保护，并按需允许 `golang/govulncheck-action`。跟踪：<https://github.com/devcxl/rustdesk-api/issues/30>
- 通过标准：所有 `uses:` 为 40 位 SHA；发布 job 需要受保护 ref/环境；token 权限与 job 匹配。

### 10. 构建工具链/基础镜像摘要
- 已修复：基础镜像固定到 multi-arch manifest list digest；两个 musl 工具链包在解压前校验 SHA-256，不匹配即中止（首次记录为 trust-on-first-use）。跟踪：<https://github.com/devcxl/rustdesk-api/issues/31>
- 后续：通过 Dependabot 的 docker 生态更新 digest，工具链升级需人工复核后同步哈希。

## 其他跟踪事项（非 needs-validation）

已修复：

- #32 管理端 CRUD 按 Owner 过滤（`d37df1c`）；升级前如需管理遗留行，先归并 `user_id`。
- #33 OAuth 绑定加固（`8de12f8`）；遗留 `user_thirds` op 变体需要一次性迁移（见 #39）。
- #34 管理台 `id`/`row_id` 契约修复（`76d25b2`）。
- #35 dev 镜像不再打包本地 conf（`043f8bb`）。
- #36 测试 RSA 私钥已移除（`043f8bb`）。
- #37 会话绝对寿命 + 管理端 JWT 过期对齐（`1a8edc8`）；升级后超过 30 天的旧令牌需重新登录。
- #38 LoginLimiter/验证码死代码与无效配置已删除（`04b6417`）。

待处理：

- #29 已按方案 C 处理：管理台浏览器绑定 + 文档；桌面端风险已接受。
- #30 托管侧 tag/environment 保护与 action 白名单（Dependabot alerts 与 security updates 已通过 API 开启，代码已固定 SHA）。
- #31 已修复：镜像 digest 与工具链哈希固定（`cf01be6`）。
- #39 已修复：启动时自动归一化/去重并建立唯一索引（`0c0fc2e`）。

## 复核命令

```bash
GOPROXY=off GOFLAGS=-mod=readonly go test ./... -count=1
GOOS=windows GOPROXY=off GOFLAGS=-mod=readonly go build ./cmd/... ./http/... ./lib/... ./service/...
cd admin && pnpm build
```
