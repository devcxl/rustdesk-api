import * as React from 'react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { Toaster } from '@/components/ui/sonner'
import { getToken } from '@/lib/api'
import { AddressBookPage } from '@/pages/address-book'
import { DashboardPage } from '@/pages/dashboard'
import { LoginPage } from '@/pages/login'
import { PeersPage } from '@/pages/peers'
import { SettingsPage } from '@/pages/settings'
import { TagsPage } from '@/pages/tags'

export default function App() {
  const [currentHash, setCurrentHash] = React.useState(() => window.location.hash || '#/')

  React.useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const token = getToken()

  // 路由拦截：未登录且不在登录页
  if (!token && currentHash !== '#/login') {
    window.location.hash = '#/login'
    return <LoginPage />
  }

  // 已登录但仍在登录页
  if (token && currentHash === '#/login') {
    window.location.hash = '#/'
    return null
  }

  // 登录页直接渲染
  if (currentHash === '#/login') {
    return (
      <>
        <LoginPage />
        <Toaster position="top-right" />
      </>
    )
  }

  // 主工作区内容分发
  let pageContent: React.ReactNode = <DashboardPage />
  if (currentHash === '#/peers') {
    pageContent = <PeersPage />
  } else if (currentHash === '#/address-book') {
    pageContent = <AddressBookPage />
  } else if (currentHash === '#/tags') {
    pageContent = <TagsPage />
  } else if (currentHash === '#/settings') {
    pageContent = <SettingsPage />
  }

  return (
    <>
      <AdminLayout currentPath={currentHash}>{pageContent}</AdminLayout>
      <Toaster position="top-right" />
    </>
  )
}
