import {
  BookOpen,
  Loader2,
  Radio,
  Server,
  ShieldCheck,
} from 'lucide-react'
import * as React from 'react'

import { CopyButton, PageHeader } from '@/components/common'
import { GithubIcon } from '@/components/icons/GithubIcon'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api } from '@/lib/api'
import type { ServerConfig, User } from '@/types/api'

export function SettingsPage() {
  const [loading, setLoading] = React.useState(true)
  const [config, setConfig] = React.useState<ServerConfig | null>(null)
  const [user, setUser] = React.useState<User | null>(null)

  const loadSettings = React.useCallback(async () => {
    try {
      setLoading(true)
      const [cfg, u] = await Promise.all([
        api.config.getServer().catch(() => null),
        api.user.getCurrent().catch(() => null),
      ])
      if (cfg) setConfig(cfg)
      if (u) setUser(u)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const apiServerAddress = config?.api_server || window.location.origin
  const clientConfigString = config
    ? `host=${config.id_server},key=${config.key}`
    : ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="服务设置与系统状态"
        description="查看 RustDesk 服务端各项参数与当前 Owner 管理员身份"
      />

      {/* 两列自适应布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 左侧：账户身份与客户端指引 */}
        <div className="space-y-6">
          {/* 账户安全与管理员身份 */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">系统 Owner 账户身份</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    单用户模式下通过 GitHub OAuth 授权确立的系统唯一管理员
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3.5">
              <div className="flex items-start sm:items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0">
                    <GithubIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {user?.username || 'Owner'}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium"
                      >
                        系统唯一管理员 (Owner)
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      已通过环境变量白名单认证，享有系统全部运维控制权限
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3.5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <div className="font-medium text-foreground">单用户运行说明</div>
                <p>
                  本自建服务运行在严格的单用户受限模式下，仅允许白名单指定的 GitHub
                  账户登录与管理。非授权用户无法访问受控设备、地址簿条目及中继配置。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 客户端配置说明指南 */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-foreground">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">客户端连接指引</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    如何在各端 RustDesk 客户端中完成连接配置
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3 items-start">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  打开 RustDesk 客户端，点击主界面设置图标，进入 <strong className="text-foreground">网络</strong> 选项设置面板。
                </p>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  填写本页展示的 <strong className="text-foreground">ID 服务器</strong>、<strong className="text-foreground">中继服务器</strong> 以及 <strong className="text-foreground">API 服务器</strong> 地址。
                </p>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  将右侧的 <strong className="text-foreground">服务端公钥 (Key)</strong> 完整粘贴至客户端 Key 输入框中并保存。
                </p>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground shrink-0 mt-0.5">
                  4
                </span>
                <p>
                  客户端底部状态指示灯变为绿色即代表成功连入私有自建中继服务，心跳上报后即可在本面板的“受控设备”与“地址簿”中统一管理。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：服务端各项参数卡片 */}
        <div className="space-y-6">
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-foreground">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">RustDesk 服务端参数</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    客户端填写的服务地址与认证公钥
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3.5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs text-muted-foreground font-medium">
                        ID 服务器 (ID Server)
                      </div>
                      <div className="font-mono text-sm font-semibold truncate" title={config?.id_server || '未配置'}>
                        {config?.id_server || '未配置'}
                      </div>
                    </div>
                    {config?.id_server && (
                      <CopyButton
                        text={config.id_server}
                        label="ID Server"
                        className="h-8 w-8"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs text-muted-foreground font-medium">
                        中继服务器 (Relay Server)
                      </div>
                      <div className="font-mono text-sm font-semibold truncate" title={config?.relay_server || '未配置'}>
                        {config?.relay_server || '未配置'}
                      </div>
                    </div>
                    {config?.relay_server && (
                      <CopyButton
                        text={config.relay_server}
                        label="Relay Server"
                        className="h-8 w-8"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs text-muted-foreground font-medium">
                        API 服务器 (API Server)
                      </div>
                      <div className="font-mono text-sm font-semibold truncate" title={apiServerAddress}>
                        {apiServerAddress}
                      </div>
                    </div>
                    <CopyButton
                      text={apiServerAddress}
                      label="API Server"
                      className="h-8 w-8"
                    />
                  </div>

                  {config?.key && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">
                          服务端公钥 (Key)
                        </span>
                        <CopyButton
                          text={config.key}
                          label="公钥 Key"
                          showText
                          size="sm"
                          className="h-6 text-xs px-2"
                        />
                      </div>
                      <p className="font-mono text-xs text-muted-foreground break-all select-all rounded border bg-background/60 p-2">
                        {config.key}
                      </p>
                    </div>
                  )}

                  {clientConfigString && (
                    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-1 min-w-0 sm:flex-row sm:items-center sm:gap-2">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground shrink-0">
                          <Radio className="h-4 w-4 text-primary shrink-0" />
                          <span>配置字符串：</span>
                        </div>
                        <code className="rounded border bg-background px-1.5 py-1 font-mono text-xs break-all select-all text-foreground">
                          {clientConfigString}
                        </code>
                      </div>
                      <CopyButton
                        text={clientConfigString}
                        label="配置字符串"
                        size="sm"
                        variant="outline"
                        showText
                        className="h-7 text-xs shrink-0 self-start sm:self-auto"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
