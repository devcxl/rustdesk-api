import {
  Check,
  Copy,
  Loader2,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { GithubIcon } from '@/components/icons/GithubIcon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
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
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(label)
    toast.success(`已复制 ${label}`)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">服务设置与系统状态</h1>
        <p className="text-sm text-muted-foreground">
          查看 RustDesk 服务端各项参数与当前 Owner 身份
        </p>
      </div>

      {/* 账户安全与管理员身份 */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg">系统 Owner 账户身份</CardTitle>
          </div>
          <CardDescription>
            单用户模式下通过 GitHub OAuth 授权确立的系统唯一管理员
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
                <GithubIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{user?.username || 'Owner'}</span>
                  <Badge variant="success" className="text-xs">
                    系统唯一管理员 (Owner)
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  已通过环境变量白名单认证，享有系统全部运维控制权限
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 服务端参数一览 */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">RustDesk 服务端参数</CardTitle>
          </div>
          <CardDescription>
            客户端填写的服务地址与认证公钥
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <div className="text-xs text-muted-foreground font-medium">ID 服务器 (ID Server)</div>
                  <div className="font-mono text-sm font-semibold">{config?.id_server || '未指定'}</div>
                </div>
                {config?.id_server && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(config.id_server, 'ID Server')}
                  >
                    {copiedKey === 'ID Server' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <div className="text-xs text-muted-foreground font-medium">中继服务器 (Relay Server)</div>
                  <div className="font-mono text-sm font-semibold">{config?.relay_server || '未指定'}</div>
                </div>
                {config?.relay_server && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(config.relay_server, 'Relay Server')}
                  >
                    {copiedKey === 'Relay Server' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <div className="text-xs text-muted-foreground font-medium">API 服务器 (API Server)</div>
                  <div className="font-mono text-sm font-semibold">{config?.api_server || window.location.origin}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyToClipboard(config?.api_server || window.location.origin, 'API Server')}
                >
                  {copiedKey === 'API Server' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {config?.key && (
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">服务端公钥 (Key)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => copyToClipboard(config.key, 'Key')}
                    >
                      {copiedKey === 'Key' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      复制
                    </Button>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground break-all">{config.key}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 客户端配置说明指南 */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">客户端连接指引</CardTitle>
          </div>
          <CardDescription>
            如何在各端 RustDesk 客户端中完成连接配置
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            1. 打开 RustDesk 客户端，点击主界面左侧或顶部的设置图标（⚙️），进入 <strong>网络</strong> 选项。
          </p>
          <p>
            2. 勾选并填写上方展示的 <strong>ID 服务器</strong>、<strong>中继服务器</strong> 以及 <strong>API 服务器</strong>。
          </p>
          <p>
            3. 将 <strong>公钥 (Key)</strong> 完整粘贴至客户端对应的 Key 输入框中并保存。
          </p>
          <p>
            4. 客户端底部状态指示灯变为绿色即代表成功连入私有自建中继服务，心跳上报后即可在本面板的“受控设备”与“地址簿”中统一管理。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
