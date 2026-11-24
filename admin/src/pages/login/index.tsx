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
import {
  canAutoRedirect,
  clearAutoLoginSuppression,
  clearAutoRedirectState,
  markAutoRedirect,
} from '@/lib/authStorage'

const CALLBACK_PREFIX = '#/oauth/callback'
const CALLBACK_ATTEMPTS = 5
const CALLBACK_RETRY_MS = 400

function readCallbackState(): string {
  const hash = window.location.hash || ''
  if (!hash.startsWith(CALLBACK_PREFIX)) {
    return ''
  }
  const queryIndex = hash.indexOf('?')
  if (queryIndex < 0) {
    return ''
  }
  return new URLSearchParams(hash.slice(queryIndex + 1)).get('state') || ''
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function LoginPage() {
  const [loading, setLoading] = React.useState(false)
  const [statusText, setStatusText] = React.useState('')
  const [errorText, setErrorText] = React.useState('')
  const startedRef = React.useRef(false)

  const startLogin = React.useCallback(async () => {
    try {
      setLoading(true)
      setErrorText('')
      setStatusText('正在跳转 GitHub 授权页面...')
      const { url } = await api.login.oidcAuth('github')
      markAutoRedirect()
      // 整页跳转不依赖弹窗权限；服务端回调会带 state 返回 SPA。
      window.location.assign(url)
    } catch (err: any) {
      setLoading(false)
      setStatusText('')
      setErrorText(err.message || '发起 GitHub 授权失败')
    }
  }, [])

  const finishLogin = React.useCallback(async (state: string) => {
    setLoading(true)
    setErrorText('')
    setStatusText('正在确认 GitHub 授权...')
    for (let attempt = 0; attempt < CALLBACK_ATTEMPTS; attempt++) {
      try {
        const res = await api.login.oidcAuthQuery(state)
        if (res && res.token) {
          setToken(res.token)
          clearAutoRedirectState()
          setStatusText('授权成功，正在进入系统...')
          window.location.hash = '#/'
          return
        }
      } catch {
        // 回调刚写入缓存时可能还没就绪，短暂重试。
      }
      if (attempt < CALLBACK_ATTEMPTS - 1) {
        await sleep(CALLBACK_RETRY_MS)
      }
    }
    // 失败后不要立即再次自动跳转，保留手动按钮。
    markAutoRedirect()
    window.location.hash = '#/login'
    setLoading(false)
    setStatusText('')
    setErrorText('登录确认失败，请重新点击 GitHub 登录')
  }, [])

  React.useEffect(() => {
    if (startedRef.current) {
      return
    }
    startedRef.current = true

    const callbackState = readCallbackState()
    if (callbackState) {
      void finishLogin(callbackState)
      return
    }
    if (canAutoRedirect()) {
      markAutoRedirect()
      void startLogin()
    }
  }, [finishLogin, startLogin])

  const handleManualLogin = () => {
    clearAutoLoginSuppression()
    void startLogin()
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
            onClick={handleManualLogin}
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
