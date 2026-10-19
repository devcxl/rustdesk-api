import {
  BookUser,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Server,
  Settings,
  ShieldCheck,
  Sun,
  Tags,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api, removeToken } from '@/lib/api'
import { useTheme } from '@/lib/theme'
import type { User } from '@/types/api'

interface AdminLayoutProps {
  currentPath: string
  children: React.ReactNode
}

export function AdminLayout({ currentPath, children }: AdminLayoutProps) {
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = React.useState<User | null>(null)

  React.useEffect(() => {
    api.user
      .getCurrent()
      .then((u) => setUser(u))
      .catch(() => {})
  }, [])

  const navItems = [
    { label: '仪表盘', icon: LayoutDashboard, path: '#/' },
    { label: '受控设备', icon: Monitor, path: '#/peers' },
    { label: '地址簿', icon: BookUser, path: '#/address-book' },
    { label: '标签管理', icon: Tags, path: '#/tags' },
    { label: '服务设置', icon: Settings, path: '#/settings' },
  ]

  const handleLogout = async () => {
    try {
      await api.login.logout()
    } catch {
      // ignore
    } finally {
      removeToken()
      window.location.hash = '#/login'
    }
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-card shadow-sm">
        {/* Logo 区域 */}
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
            <Server className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">RustDesk API</span>
            <span className="text-xs text-muted-foreground">Self-Hosted Single User</span>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 space-y-1.5 p-4">
          <div className="px-3 pb-2 text-xs font-medium text-muted-foreground">
            控制中心
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPath === item.path || (item.path === '#/' && currentPath === '')
            return (
              <a
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </a>
            )
          })}
        </nav>

        {/* 底部系统状态 */}
        <div className="border-t p-4">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="flex flex-col overflow-hidden">
              <span className="truncate font-medium text-foreground">单用户安全模式</span>
              <span className="truncate text-[11px]">GitHub OAuth 授权受控</span>
            </div>
          </div>
        </div>
      </aside>

      {/* 主工作区 */}
      <div className="flex flex-1 flex-col pl-64">
        {/* 顶部 Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">RustDesk 控制面板</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">
              {navItems.find((item) => item.path === currentPath)?.label || '控制台'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 主题切换 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? '切换为亮色模式' : '切换为深色模式'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700" />
              )}
            </Button>

            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="font-medium">{user?.username || 'Owner'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.is_admin ? '系统唯一管理员 (Owner)' : '用户'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => (window.location.hash = '#/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>服务配置</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 内容主体 */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
