# GitHub OAuth2 受限登录改造方案

> 关联 Issue: #1 ｜ 目标：将登录方式收敛为 GitHub OAuth2，并支持在配置中限定**指定组织成员**或**指定个人账号**才可登录使用。

## 1. 现状调研

### 1.1 现有登录方式
| 方式 | 入口 | 说明 |
|------|------|------|
| 账号密码 | ~~`POST /api/login`、`POST /api/admin/login`~~ | **已移除**（v2 后续版本），登录仅剩 OAuth/webauth |
| OAuth（github/google/oidc/linuxdo） | `POST /api/oidc/auth` → `/api/oidc/callback` | provider 信息存 DB（Web 后台「Oauth 管理」维护 client_id/secret），github 类型已实现 |
| Web 授权（webauth） | 后台审批 | `web-sso: true` 时客户端可经后台授权登录 |

### 1.2 现有 OAuth 技术栈
- `golang.org/x/oauth2`（含 `oauth2/github` Endpoint）+ `coreos/go-oidc`
- 回调链路：`OauthService.Callback()` → `githubCallback()` → `callbackBase()`（换 token → 拉取 `/user`、`/user/emails` 用户信息）
- 登录/注册/绑定三条路径都从 `http/controller/api/ouath.go OauthCallback()` 汇入

### 1.3 结论
GitHub OAuth2 基础能力已具备，缺的只是：**配置化的访问控制（org/个人白名单）与回调强制校验**。无需引入新依赖。

## 2. GitHub 成员资格校验 API 选型

| API | 说明 | 结论 |
|-----|------|------|
| `GET /user/memberships/orgs/{org}` | 用**用户自己的 token** 查询其与目标 org 的成员关系；200 且 `state=active` 即为有效成员；私有成员同样可见 | ✅ 采用 |
| `GET /user/orgs` | 列出用户全部 org 再本地比对 | 备选，需分页处理，放弃 |
| `GET /orgs/{org}/members/{username}` | 以应用视角查询，org 成员列表设为私有时返回 404，会误拒 | ❌ 放弃 |

权限要求：现有 scope `read:user, user:email` 即可调用 `/user/memberships/orgs/{org}`，无需额外申请 `admin:org`。

## 3. 强制点设计

**统一拦截点：`service/oauth.go githubCallback()`**（Callback 的 github 分支）。
在该处拿到 `GithubUser.Login` 与带 token 的 `http.Client`，校验失败直接返回错误，使 **登录 / 自动注册(auto_register) / 绑定(bind)** 三条路径同时被拦截，避免在各 controller 分散校验造成遗漏。

判定顺序：
1. 未启用限制（默认）→ 行为与现状一致
2. `login` 命中 `users` 白名单（大小写不敏感）→ 通过
3. 遍历 `orgs`，任一 org 校验通过 → 通过
4. 否则拒绝，回调页面展示 `GithubAccessDenied`

## 4. 配置层设计

`conf/config.yaml` 新增段（默认关闭，零影响升级）：

```yaml
github-oauth:
  restrict-enable: false   # 是否启用 GitHub 登录白名单限制
  orgs: ""                 # 允许的组织，逗号分隔，如 "acme-org,subsidiary"
  users: ""                # 允许的个人 GitHub 登录名，逗号分隔
```

- 结构体：`config.GithubOauth{RestrictEnable bool; Orgs string; Users string}`
- 环境变量覆盖：`RUSTDESK_API_GITHUB_OAUTH_RESTRICT_ENABLE` 等（viper replacer 将键中 `.`/`-` 统一替换为 `_`）
- 收敛登录方式：密码登录已直接移除；管理员通过 `github-oauth.admins` 配置引导

## 5. 任务拆解（DAG）

```
#1 调研方案(本文档) ──► #2 配置层 ──► #3 回调强制校验+单测 ──► #4 文档收尾 ──► 合并 PR
```

每个任务独立分支开发，PR 合入 master。

## 6. 风险与备注
- GitHub API 不可用时：校验请求失败按**拒绝**处理（fail-closed），保证不放大权限
- 白名单大小写不敏感；`users` 与 `orgs` 同时配置时取并集
- 已存在的本地绑定用户不受影响——限制发生在 OAuth 握手阶段，未通过即无法换取 token 完成任何动作
