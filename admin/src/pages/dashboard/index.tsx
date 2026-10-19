import {
  ArrowRight,
  BookUser,
  Check,
  Copy,
  Laptop,
  Monitor,
  Radio,
  Server,
  ShieldAlert,
  Tags,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

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
import type { Peer, ServerConfig, User } from '@/types/api'

export function DashboardPage() {
  const [loading, setLoading] = React.useState(true)
  const [user, setUser] = React.useState<User | null>(null)
  const [config, setConfig] = React.useState<ServerConfig | null>(null)
  const [peerTotal, setPeerTotal] = React.useState(0)
  const [onlineCount, setOnlineCount] = React.useState(0)
  const [addressBookTotal, setAddressBookTotal] = React.useState(0)
  const [tagTotal, setTagTotal] = React.useState(0)
  const [recentPeers, setRecentPeers] = React.useState<Peer[]>([])
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [u, cfg, peersRes, abRes, tagRes] = await Promise.all([
        api.user.getCurrent().catch(() => null),
        api.config.getServer().catch(() => null),
        api.peers.getList({ page: 1, page_size: 5 }).catch(() => null),
        api.addressBook.getList({ page: 1, page_size: 1 }).catch(() => null),
        api.tags.getList({ page: 1, page_size: 1 }).catch(() => null),
      ])

      if (u) setUser(u)
      if (cfg) setConfig(cfg)
      if (peersRes) {
        setPeerTotal(peersRes.total || 0)
        setRecentPeers(peersRes.list || [])
        const now = Math.floor(Date.now() / 1000)
        // 5分钟内有心跳视为在线
        const online = (peersRes.list || []).filter(
          (p) => now - p.last_online_time < 300
        ).length
        setOnlineCount(online)
      }
      if (abRes) setAddressBookTotal(abRes.total || 0)
      if (tagRes) setTagTotal(tagRes.total || 0)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(label)
    toast.success(`已复制 ${label} 到剪贴板`)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // 生成客户端简易配置字符串
  const clientConfigString = config
    ? `host=${config.id_server},key=${config.key}`
    : ''

  return (
    <div className="space-y-8">
      {/* 顶部欢迎区 */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">控制台概览</h1>
          <p className="text-sm text-muted-foreground">
            欢迎回来，系统唯一 Owner <span className="font-semibold text-foreground">{user?.username}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => (window.location.hash = '#/address-book')}>
            <BookUser className="mr-2 h-4 w-4" />
            新建地址簿条目
          </Button>
          <Button size="sm" onClick={() => (window.location.hash = '#/peers')}>
            <Monitor className="mr-2 h-4 w-4" />
            受控设备管理
          </Button>
        </div>
      </div>

      {/* 统计指标卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">受控设备总数</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : peerTotal}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>当前活跃约 {onlineCount} 台</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">地址簿同步条目</CardTitle>
            <BookUser className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : addressBookTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">云端双向同步记录</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">设备分组标签</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : tagTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">色彩分类与筛选维度</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">系统模式</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Single User</div>
            <p className="text-xs text-muted-foreground mt-1">仅允许授权 GitHub 账号</p>
          </CardContent>
        </Card>
      </div>

      {/* 服务端连接配置卡片 */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">RustDesk 服务端参数</CardTitle>
          </div>
          <CardDescription>
            将以下服务器与公钥配置填入 RustDesk 客户端的网络设置中，或直接使用一键配置字符串
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">ID 服务器 (ID Server)</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{config?.id_server || '未配置'}</span>
                {config?.id_server && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(config.id_server, 'ID Server')}
                  >
                    {copiedKey === 'ID Server' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">中继服务器 (Relay Server)</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{config?.relay_server || '未配置'}</span>
                {config?.relay_server && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(config.relay_server, 'Relay Server')}
                  >
                    {copiedKey === 'Relay Server' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">API 服务器 (API Server)</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{config?.api_server || window.location.origin}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(config?.api_server || window.location.origin, 'API Server')}
                >
                  {copiedKey === 'API Server' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* 公钥 Key */}
          {config?.key && (
            <div className="rounded-lg border bg-muted/20 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">公钥 (Key)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => copyToClipboard(config.key, 'Key')}
                >
                  {copiedKey === 'Key' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  复制公钥
                </Button>
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all">{config.key}</p>
            </div>
          )}

          {/* 客户端一键配置代码 */}
          {clientConfigString && (
            <div className="flex items-center justify-between rounded-lg border bg-primary/5 p-3.5 text-sm">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">客户端简易配置字符串：</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">{clientConfigString}</code>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => copyToClipboard(clientConfigString, '配置字符串')}
              >
                {copiedKey === '配置字符串' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                复制字符串
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近设备列表 */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">近期活跃设备</CardTitle>
            <CardDescription>受控端心跳连入的设备记录</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => (window.location.hash = '#/peers')}>
            查看全部 <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentPeers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
              <Laptop className="h-8 w-8 mb-2 opacity-40" />
              <p>暂无连入的受控设备</p>
              <p className="text-xs mt-1">在客户端输入上述配置参数后，设备将自动注册至此</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPeers.map((peer) => {
                const now = Math.floor(Date.now() / 1000)
                const isOnline = now - peer.last_online_time < 300
                return (
                  <div
                    key={peer.row_id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{peer.alias || peer.hostname || peer.id}</span>
                          <Badge variant={isOnline ? 'success' : 'secondary'} className="text-[10px]">
                            {isOnline ? '在线' : '离线'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
                          <span>ID: {peer.id}</span>
                          <span>•</span>
                          <span>{peer.os || 'Unknown OS'}</span>
                          <span>•</span>
                          <span>{peer.last_online_ip || '未知IP'}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => (window.location.hash = '#/peers')}
                    >
                      详情
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
