import { Loader2, Server } from 'lucide-react'
import * as React from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api, setToken } from '@/lib/api'

export function LoginPage() {
  const [loading, setLoading] = React.useState(false)
  const [statusText, setStatusText] = React.useState('')
  const [errorText, setErrorText] = React.useState('')

  const handleGitHubLogin = async () => {
    try {
      setLoading(true)
      setErrorText('')
      setStatusText('正在请求 GitHub 授权链接...')
      const { code, url } = await api.login.oidcAuth('github')

      setStatusText('正在等待 GitHub 授权确认...')

      // 打开新窗口进行 OAuth 授权，或者在当前页直接跳转
      const authWindow = window.open(
        url,
        'oauth_window',
        'width=600,height=700,status=no,resizable=yes'
      )

      // 轮询查询授权结果
      const interval = setInterval(async () => {
        try {
          const res = await api.login.oidcAuthQuery(code)
          if (res && res.token) {
            clearInterval(interval)
            setToken(res.token)
            setStatusText('授权成功，正在进入系统...')
            if (authWindow && !authWindow.closed) {
              authWindow.close()
            }
            window.location.hash = '#/'
          }
        } catch {
          // 继续轮询
        }
      }, 1500)

      // 3 分钟超时保护
      setTimeout(() => {
        clearInterval(interval)
        if (loading) {
          setLoading(false)
          setStatusText('')
          setErrorText('授权超时，请重试')
        }
      }, 180000)
    } catch (err: any) {
      setLoading(false)
      setStatusText('')
      setErrorText(err.message || '发起 GitHub 授权失败')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-muted">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
            <Server className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">RustDesk API</CardTitle>
          <CardDescription className="text-sm">
            自托管管理控制面板
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorText && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {errorText}
            </div>
          )}

          {statusText && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{statusText}</span>
            </div>
          )}

          <Button
            className="w-full h-11 text-base font-medium shadow"
            onClick={handleGitHubLogin}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <GithubIcon className="mr-2 h-5 w-5" />
            )}
            使用 GitHub 账号登录
          </Button>
        </CardContent>
        <CardFooter className="justify-center border-t py-4 text-xs text-muted-foreground">
          RustDesk Self-Hosted API Server
        </CardFooter>
      </Card>
    </div>
  )
}
