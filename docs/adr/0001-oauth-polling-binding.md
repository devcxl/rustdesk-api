# ADR-0001: OAuth 登录的浏览器授权与轮询客户端绑定

- **状态**: Proposed（设计提案，未实现）
- **日期**: 2026-11-25
- **关联**: Issue #29、`docs/security-todos.md` 第 7 项；审计原文见本地 `.security-audit/run-1/NEEDS-VALIDATION.md`（未纳入版本库）
- **代码基线**: `803e91c`
- **决策者**: Owner

> 本文只描述设计与迁移方案，不包含实现；当前 HEAD 的行为保持不变。

## 1. 背景

`POST /api/oidc/auth` 由匿名调用方发起，返回的 `state` 同时承担两个角色：GitHub 回调的关联键，以及轮询 `auth-query` 兑换 User Token 的唯一凭据。RustDesk 桌面端"浏览器授权 + 桌面客户端轮询"的跨设备交接是产品设计，但服务端没有签发只有发起方持有的轮询凭据，也没有浏览器侧的显式确认。攻击者可以自己发起流程，把返回的 GitHub 授权 URL 发给 Owner；Owner 授权后，回调把 Owner 的 `UserId` 写入攻击者的 `state` 缓存；攻击者轮询即可取得 Owner 的 User Token。

安全审计将此列为 **needs-validation**：能否成功取决于 GitHub 对已授权应用的自动批准行为与部署配置；但"服务端未绑定轮询客户端"是源码可见事实。

## 2. 当前流程（HEAD `803e91c`）

1. **发起**：`POST /api/oidc/auth`（`http/router/api.go:45`，公开路由；`middleware.RustAuth` 在 `:72` 才挂载）。`http/controller/api/ouath.go:45-61` 调用 `BeginAuth` 生成 `state`/`verifier`/`nonce`（`service/oauth.go:141-143`），把调用方提供的 `id`/`uuid`/`deviceInfo` 与 verifier 写入 `OauthCache[state]`，TTL 300 秒。响应为 `{code: state, url: authorizeURL}`（`:63-66`）。
2. **浏览器授权**：`url` 携带 `state` 与 PKCE challenge（`service/oauth.go:145-151`）；GitHub 回调 `GET /api/oidc/callback?code&state`（`http/router/api.go:53-54`）。
3. **回调**：`http/controller/api/ouath.go:158-300` 以 `state` 查缓存（`:170`），用缓存中的 verifier 换取 GitHub token 并校验 allowlist（`:201`；`service/oauth.go:321-336`），然后把授权用户写入 `oauthCache.UserId`（`:274`），并以 `expire=0` 回写缓存（`:275`）。
4. **轮询**：`GET /api/oidc/auth-query?code=<state>`（`http/router/api.go:47`，公开）。`OidcAuthQueryPre` 只按 `q.Code` 查缓存（`http/controller/api/ouath.go:81`），`UserId != 0` 时删除缓存（`:101`）并调用 `UserService.Login` 铸造 User Token（`:104-110`）。请求中的 `q.Id`/`q.Uuid` 从未参与校验（`http/request/api/oauth.go:3-14`）。
5. **管理台**：`POST /api/admin/oidc/auth`（`http/router/admin.go:35`，`LoginBind` 在 `:19`，早于 `:22` 的 `BackendUserAuth`）复用同一缓存；回调后重定向到 `/_admin/#/oauth/callback?state=...`（`http/controller/api/ouath.go:145-147, 286`）。

已有缓解：缓存上限 1000（`service/oauth.go:71, 106-124`）、失败/已完成 state 单次消费（`http/controller/api/ouath.go:187-193, 203-204`）、请求上下文贯通（`:201`）、按 IP 限流（`http/middleware/ratelimit.go:34-38`）、webadmin 的 state 放在 URL fragment（`:145-147`）。这些控制限制了滥用规模与重放，但没有回答"谁有权兑换"。

## 3. 威胁模型

**攻击者能力**：远程未认证；可调用全部公开 OAuth 路由；可取得自己发起的 `state` 与授权 URL；可向 Owner 发送链接或消息；不能读取 Owner 的浏览器、GitHub 会话、服务端缓存或日志；不能猜中 32 字符随机 `state`（`utils/tools.go:68-80`）。

**前置条件**：

1. GitHub OAuth App 已配置，Owner 位于 `users`/`admins` 或组织允许列表（`service/oauth.go:361-447`）——Owner 正是攻击目标。
2. Owner 已登录 GitHub，且可能已授权过该 App；若 GitHub 对已授权 App 自动批准，攻击只需让 Owner 打开一次链接。
3. 攻击者能在回调写入后轮询（流程由攻击者发起，合法客户端不在该流程中，无竞争），且 API 对双方可达。

**攻击路径**：`POST /api/oidc/auth` 取得 `(state, url)` → 把 `url` 发给 Owner → Owner 在浏览器完成 GitHub 授权 → 回调把 Owner 的 `UserId` 写入攻击者的 `state` → 攻击者轮询 `auth-query` 得到 User Token。管理台流程同理，只是回调会把 Owner 的 SPA 带到 `#/oauth/callback?state=...`；攻击者改用客户端入口或抢先轮询即可。

**影响**：攻击者获得绑定其 `id`/`uuid` 的 Owner User Token，可访问 `/api/*` 下的 Peer、Address Book（含连接密码）等数据，等同于 Owner 的 RustDesk API 会话；若走管理台入口，则是管理员令牌。

**非目标**：GitHub 账号或 OAuth App 被攻破、服务端/反向代理被攻破、Owner 知情且主动授权陌生设备、浏览器或扩展被攻破、DoS/洪泛（见其他 issue）、传输层安全、多租户隔离。

**现有控制为何不足**：缓存上限、单次消费、请求取消与限流只约束规模、重放和资源消耗；PKCE 保护授权码交换，而攻击者并未截获 `code`；allowlist 保证只有 Owner 能登录，而 Owner 就是受害者；`state` 不可猜，但攻击者是合法取得的。

## 4. 方案对比

### A. Device Authorization Grant 风格 + 已认证浏览器确认

- 发起方调用新增的 `POST /api/oidc/device/auth`，取得高熵 `device_code`、短 `user_code`、`verification_uri`；服务端只保存 `device_code` 的哈希。
- Owner 在已登录的管理台打开确认页，看到设备名、OS、发起 IP、时间，显式 Approve/Deny。确认通过 `api-token` 认证的 admin API 完成，`UserId` 取自会话而非请求体；这与现有 BindConfirm 的"已认证确认"模式一致（`http/controller/admin/oauth.go:86-114`）。
- 发起方用 `device_code` 轮询 `POST /api/oidc/device/token`，仅在 approved 后一次性取得 token。
- 浏览器侧（管理台登录）的 OAuth `state` 与 HttpOnly 会话 cookie 绑定，攻击者无法把预置 `state` 注入 Owner 的浏览器。

**UX**：桌面端多一次浏览器确认；管理台多一个确认页；stock 客户端需要适配或走 Phase 1 兼容路径。
**RustDesk 桌面兼容**：新端点纯增量，stock 客户端不会调用；需要在 Phase 1 保留 legacy 流程（见 §6）。
**复杂度**：中高。新增端点、grant 状态机、管理台确认页、cookie 绑定、限流与测试。
**失败模式**：Owner 未登录需先登录再回跳；grant 过期或缓存满需重新发起；多副本内存缓存不一致（现状已存在）；Owner 误点 Approve 仍会泄露 token。
**安全属性**：消除"静默/自动批准"和"攻击者预置 OAuth state"；token 只发给持有 `device_code` 的一方。剩余风险是 device-code 钓鱼：攻击者把自己的 `user_code` 告诉 Owner，诱导 Owner 在确认页批准攻击者的设备（RFC 8628 §5.4 "Remote Phishing" 明确该风险，并建议展示设备信息、要求用户确认设备在自己手中）。

### B. 服务端签发一次性轮询密钥（`state` + `poll_secret`）

- `POST /api/oidc/auth` 额外返回只给发起方的 `poll_secret`，缓存保存其哈希；`auth-query` 必须同时出示 `state` 与 `poll_secret`，成功后单次删除。
- 为兼容 stock 客户端，可让返回的 `code` 成为轮询句柄，而 OAuth `state` 只出现在授权 URL 中；stock 客户端把 `code` 当作不透明值回传，因此无需改客户端。但这只分离了两类凭据，发起方仍然同时持有两者。

**UX**：支持新参数的客户端无变化；强制要求时 stock 客户端会失败。
**RustDesk 桌面兼容**：强制 `poll_secret` 不兼容；`code` 句柄方案兼容。
**复杂度**：低。一个字段、哈希比较、单次消费与测试。
**失败模式**：客户端丢失 secret 需重新发起；secret 可能进入客户端日志；无浏览器确认。
**安全属性**：阻止只拿到 `state`（日志、Referer、URL 转发、浏览器历史）的第三方兑换；**不阻止**发起者本人就是攻击者的诱导授权，也没有浏览器确认。可满足 #29 的字面验收"未持有发起方凭据无法兑换"，但不解决主要威胁。

### C. 接受风险 + 文档/主机允许列表

- 不改变代码；文档要求 Owner 只从可信客户端发起登录，不打开他人发来的登录链接；允许列表收敛到单一 Owner 或 `admins`。
- **UX**：无变化。**兼容性**：100%。**复杂度**：仅文档。
- **安全属性**：没有技术改进，完全依赖 Owner 行为；而本威胁正是针对 Owner 的社会工程。只应作为 A/B 无法落地时的临时措施。

| 维度 | A | B | C |
|---|---|---|---|
| 阻止第三方仅凭 `state` 兑换 | 是 | 是 | 否 |
| 阻止攻击者发起的诱导授权 | 显式确认，显著提高门槛；不能根除 | 否 | 否 |
| 浏览器侧确认 | 有，且需已认证会话 | 无 | 无 |
| stock RustDesk 桌面兼容 | 需 Phase 1 兼容层 | `code` 句柄方案兼容 | 完全兼容 |
| 实现复杂度 | 中高 | 低 | 无 |
| 主要失败模式 | 确认页钓鱼/误批准 | secret 丢失或泄露 | 无技术保障 |

## 5. 推荐

推荐 **A**，并分阶段落地。理由：

1. 它同时覆盖两条真实入口：跨设备客户端流程用 device grant，浏览器管理台登录用会话绑定。B 只能保护"state 泄露"这一次要场景，无法阻止发起者本人是攻击者的主路径。
2. 它把"授权"从 GitHub 的（可能自动批准的）同意页，变成 Owner 在自己已认证的管理台里对具体设备的显式批准，并留下可限流、可拒绝、可记录的决策点。
3. `device_code` 只出现在发起方与 token 端点之间，`user_code` 不是 bearer 凭据（单独持有它无法批准，批准需要 admin 会话），URL、日志与浏览器历史中不再出现可兑换的凭据。
4. 新端点纯增量，可用配置开关与 legacy 流程并存，回滚不需要数据迁移；这是可以分阶段发布的关键。

必须明确：**A 不能根除诱导授权**。只要产品要求把 token 交给与浏览器分离的客户端，Owner 就可能被诱导批准攻击者的设备。A 的目标是把"无感、可自动完成"的攻击变成"需要 Owner 明确批准陌生设备"的攻击，并通过元数据、限流和日志降低成功率。若 Owner 要求密码学意义上的根除，唯一选择是取消跨设备交接，这与 RustDesk 桌面流程冲突。

## 6. 迁移与发布

- **Phase 0（本 RFC）**：评审；确认 stock 客户端轮询超时、GitHub 对已授权 App 的行为、部署是否多副本与 HTTPS。
- **Phase 1（服务端 + 管理台前端，向后兼容）**：
  - 管理台 `POST /api/admin/oidc/auth` 设置 `HttpOnly; SameSite=Lax; Path=/api; Max-Age=300` 的绑定 cookie；对管理台发起的条目（`BrowserBound`），回调校验 cookie 哈希，不匹配或缺失则拒绝；客户端发起的条目不受影响。这样攻击者发起的 state 无法在 Owner 浏览器完成。顺带收紧或移除未被 SPA 使用的 `POST /api/admin/oauth/confirm`（`http/controller/admin/oauth.go:63-84`，当前不校验 action 与条目归属）。
  - legacy 客户端回调不再直接写入 `UserId`，而是渲染一次性确认表单（`state` + `confirm_token` + 设备信息 + 发起 IP）；只有 `POST` 确认后才写入，拒绝则删除。`confirm_token` 只出现在回调页，攻击者无法读取；新增 `POST /api/oidc/confirm`，只接受 `state` + `confirm_token`（以及 approve/deny 决策）。
  - 可选但推荐：把轮询句柄与 OAuth `state` 分离（`code` 为轮询句柄，`state` 只在授权 URL 中），对 stock 客户端透明。
  - 新增测试与指标；`auth-query` 的响应形状不变。
- **Phase 2（新协议）**：上线 device grant 端点与管理台确认页；提供 curl 参考客户端；与 RustDesk 桌面端（fork/上游）协调适配。配置 `oidc.client-flow` 默认 `legacy-confirm`，待客户端支持后切为 `device`。
- **Phase 3（收敛）**：`device` 成为默认；legacy 端点需显式 `legacy-allow` 才可用，并记录风险；下一个大版本移除 legacy 路径。
- **回滚**：切回 `legacy-allow` 并回退前端路由即可；无数据库 schema 变更。

## 7. API 变更（均为新增）

```text
POST /api/oidc/device/auth
  req  {op, id, uuid, deviceInfo}
  resp {device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval}
POST /api/oidc/device/token
  req  {device_code}
  resp 200 {access_token, token_type: "access_token", user}
       400 {error: "authorization_pending" | "slow_down" | "expired_token" | "access_denied" | "invalid_grant"}
GET  /api/admin/oidc/device/pending?user_code=...   # api-token
POST /api/admin/oidc/device/approve                 # api-token
  req  {user_code, decision: "approve" | "deny"}
```

- 管理台新增 SPA 路由 `#/oauth/device?code=...`；登录页需要支持 `return_to`，登录后回到确认页。
- `device_code` 只放在 POST body，禁止放入 query string，避免日志泄露。
- `user_code` 使用无歧义字母表（去除 `0/O/1/I` 等），格式 `XXXX-XXXX`，大小写不敏感，服务端归一化后索引。
- 现有 `/api/oidc/auth` 的响应形状在 Phase 1 不变；`code` 对客户端仍是不透明值。

## 8. 数据与缓存

- 新增 `DeviceGrant`：`DeviceCodeHash`（SHA-256，不存明文）、`UserCode`、`Status`（`pending`/`approved`/`denied`/`consumed`）、`UserId`、`Op`、`Id`、`Uuid`、`DeviceName`/`DeviceOs`/`DeviceType`（发起方提供，仅展示）、`InitiatorIp`（服务端观测，依赖 `TrustProxy` 配置）、`CreatedAt`/`ApprovedAt`/`ExpiresAt`、`LastPollAt`、`Interval`。
- 独立的 `sync.Map` + 互斥计数，沿用 1000 条上限；pending TTL 300 秒，approved TTL 60 秒。另设 `user_code → device_code_hash` 索引，生成时 `LoadOrStore` 处理碰撞，删除时同步清理。
- legacy 缓存新增 `BrowserBindingHash`、`ConfirmTokenHash`、`InitiatorIp`；完成后 TTL 建议 60 秒（当前 `expire=0` 会一直保留到兑换）。兑换改为 `LoadAndDelete`，修复当前 `Get → Check → Delete` 的并发双兑换窗口（`http/controller/api/ouath.go:81-110`）。
- 不新增数据库表；进程重启会丢失 pending grant，客户端重新发起即可。多副本部署下内存缓存不共享，需单实例、粘性会话或后续引入共享存储。

## 9. 限流与滥用防护

| 路径 | 建议限制 |
|---|---|
| `POST /api/oidc/device/auth` | 10 次/分/IP，单 IP 最多 5 个 pending grant |
| `POST /api/oidc/device/token` | 120 次/分/IP；单 grant 最小轮询间隔 2 秒，过快返回 `slow_down` |
| `GET /api/admin/oidc/device/pending` | 60 次/分/IP |
| `POST /api/admin/oidc/device/approve` | 30 次/分/IP、10 次/小时/用户；错误 `user_code` 5 次/10 分钟/IP |

- 保留现有 `/api/oidc/auth` 30 次/分、`auth-query` 120 次/分、`/api/oidc/` 60 次/分（`http/middleware/ratelimit.go:34-38`）。
- 全局 pending grant 达到上限时返回 `503 temporarily_unavailable`，不要静默丢弃；客户端指数退避并重新发起。
- 限流是 per-process、内存、固定窗口的 best-effort 控制（`http/middleware/ratelimit.go:49-108`），不能替代 grant 级节流与上限。

## 10. 测试与验收

**单元测试**（`service/`）：`device_code` 熵与长度、`user_code` 字母表/归一化/碰撞、只存哈希、状态机（pending → approved → consumed、denied、expired）、TTL 与上限、并发轮询只成功一次、错误码映射。

**集成测试**（`httptest` + 临时 SQLite + dummy Owner，不访问外网；复用 `http/router/security_fix_test.go:29-69` 的测试脚手架，并参照 `service/oauth_security_test.go:37-98` 的缓存测试。GitHub 端点硬编码在 `service/oauth.go:65, 160, 576`，离线测试在 service/controller 边界注入已完成的缓存状态，或后续引入可替换的 `oauth2.Config.Endpoint` seam）：

1. device grant 未批准时轮询返回 `authorization_pending`；批准后首次轮询返回 token，第二次返回 `invalid_grant`。
2. 只持有 `user_code`、没有 admin token 的第三方无法调用 pending/approve（401/403），也无法取得 token。
3. 只持有 legacy `state` 的第三方在 Phase 1 确认机制下无法兑换（`auth-query` 失败）。
4. deny、过期、缓存满分别返回 `access_denied`、`expired_token`、`temporarily_unavailable`。
5. 超过限流与快于 `interval` 的轮询分别返回 429 与 `slow_down`。
6. 管理台绑定 cookie：缺失/不匹配时回调拒绝；匹配时成功。
7. legacy stock 流程：预置已完成 state，未确认时 `auth-query` 不返回 token；确认后返回 token。

**手动验证**：stock RustDesk 桌面端完整登录（含确认页）；管理台登录；用 curl 走一遍 device grant。**#29 验收对照**：未持有发起方轮询凭据的客户端无法兑换已完成授权；stock 桌面跨浏览器流程仍可用；存在"第三方仅凭 state 兑换失败"的测试。

## 11. 待 Owner 决策的问题

1. 是否能修改 RustDesk 桌面客户端（fork/上游）？若不能，A 的 device grant 无法被 stock 客户端使用，Phase 1 的确认页是唯一的服务端缓解。
2. stock 客户端的轮询超时是多少？确认页必须在该超时内完成，否则客户端会先放弃。
3. GitHub 对已授权 OAuth App 是否自动批准（不显示同意页）？这决定 legacy 流程的剩余风险。
4. 部署是否始终 HTTPS、反代是否保留 `Set-Cookie`/同源路径？管理台 cookie 绑定依赖这些条件。
5. 是否要求确认页的浏览器 IP 与发起方 IP 一致（默认关闭；开启可阻断远程钓鱼，但会破坏"手机批准桌面"的场景）？
6. 是否多副本部署？若是，device grant 上线前需要共享存储。
7. legacy 流程的保留期限与配置默认值（`legacy-confirm` → `device` → `legacy-allow`）。
8. 端点命名与错误格式：`/api/oidc/device/*` 还是 `/api/oidc/device-grant/*`；错误用 RFC 8628 风格还是现有 `response.Error` 包装。
9. device grant 签发的 User Token 是否沿用现有长生命周期与自动续期语义（`service/user.go:108-122`）？

## 12. 声明

本文件是 **设计提案（Proposal）**，尚未实现；不改变当前 HEAD 的任何行为。实现前需由 Owner 对第 11 节的问题作出决策，并按第 6 节分阶段落地。
