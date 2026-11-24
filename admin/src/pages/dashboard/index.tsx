import {
  ArrowRight,
  BookUser,
  Laptop,
  Monitor,
  Radio,
  Server,
  ShieldCheck,
  Tags,
} from 'lucide-react'
import * as React from 'react'

import { CopyButton, EmptyState, PageHeader, StatusBadge } from '@/components/common'
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
import { formatRelativeTime } from '@/lib/format'
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
  const [nowUnix, setNowUnix] = React.useState(() => Math.floor(Date.now() / 1000))

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const currentNow = Math.floor(Date.now() / 1000)
      setNowUnix(currentNow)

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
        // 5分钟内有心跳视为在线
        const online = (peersRes.list || []).filter(
          (p) => currentNow - p.last_online_time < 300
        ).length
        setOnlineCount(online)
      }
      if (abRes) setAddressBookTotal(abRes.total || 0)
      if (tagRes) setTagTotal(tagRes.total || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  // 生成客户端简易配置字符串
  const clientConfigString = config
    ? `host=${config.id_server},key=${config.key}`
    : ''

  const apiServerAddress = config?.api_server || window.location.origin

  return (
    <div className="space-y-6">
      {/* 顶部标题区 */}
      <PageHeader
        title="控制台概览"
        description={
          <span>
            欢迎回来，系统唯一管理员{' '}
            <span className="font-semibold text-foreground">
              {user?.username || 'Owner'}
            </span>
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.hash = '#/address-book')}
              className="gap-1.5 cursor-pointer"
            >
              <BookUser className="h-4 w-4" />
              <span>新建地址簿条目</span>
            </Button>
            <Button
              size="sm"
              onClick={() => (window.location.hash = '#/peers')}
              className="gap-1.5 cursor-pointer"
            >
              <Monitor className="h-4 w-4" />
              <span>受控设备管理</span>
            </Button>
          </>
        }
      />

      {/* 统计指标卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 受控设备 */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              受控设备总数
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
              <Monitor className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {loading ? '-' : peerTotal}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>活跃约 {onlineCount} 台</span>
            </div>
          </CardContent>
        </Card>

        {/* 地址簿条目 */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              地址簿同步条目
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
              <BookUser className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {loading ? '-' : addressBookTotal}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">云端双向同步记录</p>
          </CardContent>
        </Card>

        {/* 分组标签 */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              设备分组标签
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
              <Tags className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {loading ? '-' : tagTotal}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">色彩分类与筛选维度</p>
          </CardContent>
        </Card>

        {/* 访问安全模式 */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              系统运行模式
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              Single User
            </div>
            <p className="mt-1 text-xs text-muted-foreground">白名单 OAuth 隔离受控</p>
          </CardContent>
        </Card>
      </div>

      {/* 服务端连接配置卡片 */}
      <Card className="shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-foreground">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">RustDesk 服务端参数</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                将以下服务地址与公钥填入客户端网络设置中，或直接使用一键配置字符串
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 服务器地址三个维度 */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-3.5 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                ID 服务器 (ID Server)
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold truncate" title={config?.id_server || '未配置'}>
                  {config?.id_server || '未配置'}
                </span>
                {config?.id_server && (
                  <CopyButton
                    text={config.id_server}
                    label="ID Server"
                    className="h-7 w-7"
                  />
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                中继服务器 (Relay Server)
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold truncate" title={config?.relay_server || '未配置'}>
                  {config?.relay_server || '未配置'}
                </span>
                {config?.relay_server && (
                  <CopyButton
                    text={config.relay_server}
                    label="Relay Server"
                    className="h-7 w-7"
                  />
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                API 服务器 (API Server)
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold truncate" title={apiServerAddress}>
                  {apiServerAddress}
                </span>
                <CopyButton
                  text={apiServerAddress}
                  label="API Server"
                  className="h-7 w-7"
                />
              </div>
            </div>
          </div>

          {/* 公钥 Key */}
          {config?.key && (
            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  服务端公钥 (Key)
                </span>
                <CopyButton
                  text={config.key}
                  label="公钥 Key"
                  showText
                  size="sm"
                  className="h-7 text-xs px-2"
                />
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all select-all rounded bg-background/60 border p-2">
                {config.key}
              </p>
            </div>
          )}

          {/* 客户端一键配置代码 */}
          {clientConfigString && (
            <div className="flex flex-col gap-2.5 rounded-lg border bg-muted/20 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1.5 min-w-0 sm:flex-row sm:items-center sm:gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
                  <Radio className="h-4 w-4 text-primary shrink-0" />
                  <span>客户端简易配置字符串：</span>
                </div>
                <code className="rounded border bg-background px-2 py-1 font-mono text-xs font-medium break-all select-all text-foreground">
                  {clientConfigString}
                </code>
              </div>
              <CopyButton
                text={clientConfigString}
                label="一键配置字符串"
                showText
                size="sm"
                variant="outline"
                className="h-8 text-xs shrink-0 self-start sm:self-auto"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近设备列表 */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base font-semibold">近期活跃设备</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              受控端向此服务器上报心跳的最新记录
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.hash = '#/peers')}
            className="text-xs gap-1 cursor-pointer"
          >
            <span>查看全部</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentPeers.length === 0 ? (
            <EmptyState
              icon={Laptop}
              title="暂无连入的受控设备"
              description="在客户端填入上述服务器配置参数后，设备将自动注册至此"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.hash = '#/settings')}
                  className="text-xs"
                >
                  查看客户端配置指南
                </Button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {recentPeers.map((peer) => {
                const isOnline = nowUnix - peer.last_online_time < 300
                const displayName = peer.alias || peer.hostname || peer.id
                return (
                  <div
                    key={peer.row_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground shrink-0">
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate" title={displayName}>
                            {displayName}
                          </span>
                          <StatusBadge online={isOnline} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5 flex-wrap">
                          <span title={peer.id}>ID: {peer.id}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            {peer.os || 'Unknown OS'}
                          </Badge>
                          <span>•</span>
                          <span>{peer.last_online_ip || '未知IP'}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(peer.last_online_time, nowUnix)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <CopyButton
                        text={peer.id}
                        label="设备 ID"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs cursor-pointer"
                        onClick={() => (window.location.hash = '#/peers')}
                      >
                        设备管理
                      </Button>
                    </div>
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
