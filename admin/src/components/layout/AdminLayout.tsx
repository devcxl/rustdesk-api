import {
  BookUser,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Server,
  Settings,
  ShieldCheck,
  Sun,
  Tags,
  X,
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
import { suppressAutoLogin } from '@/lib/authStorage'
import { useTheme } from '@/lib/theme'
import type { User } from '@/types/api'

interface AdminLayoutProps {
  currentPath: string
  children: React.ReactNode
}

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

const navItems: NavItem[] = [
  { label: '仪表盘', icon: LayoutDashboard, path: '#/' },
  { label: '受控设备', icon: Monitor, path: '#/peers' },
  { label: '地址簿', icon: BookUser, path: '#/address-book' },
  { label: '标签管理', icon: Tags, path: '#/tags' },
  { label: '服务设置', icon: Settings, path: '#/settings' },
]

export function AdminLayout({ currentPath, children }: AdminLayoutProps) {
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = React.useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    api.user
      .getCurrent()
      .then((u) => setUser(u))
      .catch(() => {})
  }, [])

  // 移动端 Drawer 打开时锁定 body 滚动并监听 Escape 键
  React.useEffect(() => {
    if (!mobileOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  const handleLogout = async () => {
    // 显式登出后不得自动再次跳转 GitHub 授权。
    suppressAutoLogin()
    try {
      await api.login.logout()
    } catch {
      // ignore
    } finally {
      removeToken()
      window.location.hash = '#/login'
    }
  }

  const currentNav =
    navItems.find(
      (item) =>
        item.path === currentPath ||
        (item.path === '#/' && (currentPath === '' || currentPath === '#/'))
    ) || navItems[0]

  const renderNavLinks = (onItemClick?: () => void) => (
    <nav className="flex-1 space-y-1 p-3">
      <div className="px-3 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        控制中心
      </div>
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive =
          currentPath === item.path ||
          (item.path === '#/' && (currentPath === '' || currentPath === '#/'))
        return (
          <a
            key={item.path}
            href={item.path}
            onClick={() => onItemClick?.()}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col">
      {/* 品牌区域 */}
      <div className="flex h-16 items-center justify-between border-b px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Server className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              RustDesk API
            </span>
            <span className="text-[11px] text-muted-foreground">自托管单用户控制台</span>
          </div>
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭侧边菜单"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 导航 */}
      {renderNavLinks(() => isMobile && setMobileOpen(false))}

      {/* 底部系统状态 */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex flex-col overflow-hidden leading-tight">
            <span className="truncate font-medium text-foreground">单用户安全模式</span>
            <span className="truncate text-[11px] text-muted-foreground">
              GitHub OAuth 授权控制
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* 桌面端固定侧边栏 (w-[260px]) */}
      <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 md:z-30 border-r bg-card shadow-xs">
        {renderSidebarContent(false)}
      </aside>

      {/* 移动端抽屉导航与遮罩 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* 抽屉侧边栏 */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="导航菜单"
            className="fixed inset-y-0 left-0 z-50 w-[260px] bg-card border-r shadow-2xl flex flex-col"
          >
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* 主工作区 */}
      <div className="flex flex-1 flex-col md:pl-[260px] min-w-0">
        {/* 顶部 Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 sm:px-6 lg:px-8 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-3 min-w-0">
            {/* 移动端菜单按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="打开导航菜单"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* 面包屑导航 */}
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-muted-foreground hidden sm:inline">RustDesk 控制面板</span>
              <span className="text-muted-foreground hidden sm:inline">/</span>
              <span className="font-semibold text-foreground truncate">{currentNav.label}</span>
            </div>
          </div>

          {/* 顶栏右侧动作 */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 主题切换 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? '切换为亮色模式' : '切换为深色模式'}
              title={theme === 'dark' ? '切换为亮色模式' : '切换为深色模式'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-9 px-3 font-normal cursor-pointer"
                  aria-label="用户账户菜单"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="font-medium text-xs sm:text-sm max-w-[100px] truncate">
                    {user?.username || 'Owner'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal p-3">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none text-foreground">
                      {user?.username || 'Owner'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.is_admin ? '系统唯一管理员 (Owner)' : '受权用户'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => (window.location.hash = '#/settings')}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>服务配置</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 内容主体 */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
