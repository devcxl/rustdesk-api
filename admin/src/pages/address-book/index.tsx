import {
  BookUser,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import {
  CopyButton,
  EmptyState,
  PageHeader,
  TableSkeleton,
} from '@/components/common'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { getTagDotStyle } from '@/lib/format'
import type { AddressBook, Tag } from '@/types/api'

export function AddressBookPage() {
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<AddressBook[]>([])
  const [tags, setTags] = React.useState<Tag[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const pageSize = 15
  const [search, setSearch] = React.useState('')

  // 密码显示状态记录
  const [showPasswordMap, setShowPasswordMap] = React.useState<Record<number, boolean>>({})

  // 新增/编辑弹窗
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<AddressBook | null>(null)
  const [formId, setFormId] = React.useState('')
  const [formAlias, setFormAlias] = React.useState('')
  const [formHostname, setFormHostname] = React.useState('')
  const [formPassword, setFormPassword] = React.useState('')
  const [formPlatform, setFormPlatform] = React.useState('Windows')
  const [formSelectedTags, setFormSelectedTags] = React.useState<string[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  // 删除确认
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  const loadTags = React.useCallback(async () => {
    try {
      const res = await api.tags.getList({ page: 1, page_size: 100 })
      setTags(res.list || [])
    } catch {
      // ignore
    }
  }, [])

  const loadAddressBook = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.addressBook.getList({
        page,
        page_size: pageSize,
        hostname: search || undefined,
      })
      setItems(res.list || [])
      setTotal(res.total || 0)
    } catch (err: any) {
      toast.error(err.message || '加载地址簿失败')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  React.useEffect(() => {
    queueMicrotask(() => {
      void loadTags()
    })
  }, [loadTags])

  React.useEffect(() => {
    queueMicrotask(() => {
      void loadAddressBook()
    })
  }, [loadAddressBook])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    void loadAddressBook()
  }

  const openCreateDialog = () => {
    setEditingItem(null)
    setFormId('')
    setFormAlias('')
    setFormHostname('')
    setFormPassword('')
    setFormPlatform('Windows')
    setFormSelectedTags([])
    setDialogOpen(true)
  }

  const openEditDialog = (item: AddressBook) => {
    setEditingItem(item)
    setFormId(item.id)
    setFormAlias(item.alias || '')
    setFormHostname(item.hostname || '')
    setFormPassword(item.password || '')
    setFormPlatform(item.platform || 'Windows')
    setFormSelectedTags(item.tags || [])
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formId.trim()) {
      toast.error('设备 ID 不能为空')
      return
    }

    try {
      setSubmitting(true)
      const payload: Partial<AddressBook> = {
        id: formId.trim(),
        alias: formAlias.trim(),
        hostname: formHostname.trim(),
        password: formPassword,
        platform: formPlatform,
        tags: formSelectedTags,
      }

      if (editingItem) {
        await api.addressBook.update({
          ...payload,
          row_id: editingItem.row_id,
        })
        toast.success('条目已更新')
      } else {
        await api.addressBook.create(payload)
        toast.success('条目已创建')
      }
      setDialogOpen(false)
      void loadAddressBook()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    try {
      await api.addressBook.delete(deleteId)
      toast.success('条目已从地址簿删除')
      void loadAddressBook()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    } finally {
      setDeleteId(null)
    }
  }

  const togglePasswordVisibility = (rowId: number) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }))
  }

  const getTagDotByName = (tagName: string) => {
    const matched = tags.find((t) => t.name === tagName)
    return getTagDotStyle(matched?.color)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <PageHeader
        title="地址簿管理"
        description="双向同步至 RustDesk 各客户端的个人受控设备地址簿与访问凭据"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadAddressBook()}
              disabled={loading}
              className="gap-1.5 cursor-pointer"
              aria-label="刷新地址簿"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </Button>
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="gap-1.5 cursor-pointer"
              aria-label="新建地址簿条目"
            >
              <Plus className="h-4 w-4" />
              <span>新建条目</span>
            </Button>
          </>
        }
      />

      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
            <Input
              placeholder="搜索主机名或设备ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-xs sm:text-sm"
              aria-label="搜索地址簿"
            />
            <Button type="submit" size="sm" variant="secondary" className="gap-1 h-9 cursor-pointer shrink-0">
              <Search className="h-4 w-4" />
              <span>搜索</span>
            </Button>
          </form>
        </CardHeader>

        <CardContent className="p-0">
          {/* 桌面端表格视图 (md 及以上显示) */}
          <div className="hidden xl:block w-full overflow-x-auto scrollbar-thin">
            <Table className="min-w-[700px]">
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-36">设备 ID</TableHead>
                  <TableHead>别名</TableHead>
                  <TableHead className="hidden lg:table-cell">主机名</TableHead>
                  <TableHead className="hidden lg:table-cell">平台</TableHead>
                  <TableHead>标签分类</TableHead>
                  <TableHead className="w-48">访问密码</TableHead>
                  <TableHead className="text-right pr-6 w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableSkeleton columns={7} rows={5} />
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center p-0">
                      <EmptyState
                        icon={BookUser}
                        title="地址簿暂无条目"
                        description="可点击新建条目，或在受控设备列表中勾选设备后一键批量导入"
                        action={
                          <div className="flex items-center gap-2 justify-center">
                            <Button size="sm" onClick={openCreateDialog} className="text-xs">
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              新建条目
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => (window.location.hash = '#/peers')}
                              className="text-xs"
                            >
                              <Monitor className="mr-1 h-3.5 w-3.5" />
                              前往受控设备管理
                            </Button>
                          </div>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const isShowPwd = showPasswordMap[item.row_id]
                    return (
                      <TableRow key={item.row_id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                            <span className="truncate" title={item.id}>
                              {item.id}
                            </span>
                            <CopyButton
                              text={item.id}
                              label="设备 ID"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-medium text-foreground truncate block max-w-[140px]"
                            title={item.alias || '-'}
                          >
                            {item.alias || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          <span
                            className="truncate block max-w-[120px]"
                            title={item.hostname || '-'}
                          >
                            {item.hostname || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {item.platform || 'General'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {item.tags && item.tags.length > 0 ? (
                              item.tags.map((t) => (
                                <Badge
                                  key={t}
                                  variant="outline"
                                  className="gap-1 text-[11px] font-medium border bg-muted/40 text-foreground"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={getTagDotByName(t)} />
                                  {t}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.password ? (
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span className="truncate max-w-[90px] select-all">
                                {isShowPwd ? item.password : '••••••••'}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => togglePasswordVisibility(item.row_id)}
                                title={isShowPwd ? '隐藏密码' : '显示密码'}
                                aria-label={isShowPwd ? '隐藏密码' : '显示密码'}
                              >
                                {isShowPwd ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.password || '')
                                  toast.success('已复制访问密码')
                                }}
                                title="复制密码"
                                aria-label="复制密码"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">未预设</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditDialog(item)}
                              title="编辑条目"
                              aria-label="编辑条目"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteId(item.row_id)}
                              title="删除条目"
                              aria-label="删除条目"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 移动端卡片视图 (md 以下显示) */}
          <div className="xl:hidden p-3 space-y-3">
            {loading && items.length === 0 ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={`ab-skel-${idx}`} className="rounded-lg border bg-card p-3.5 space-y-2.5 animate-pulse">
                  <div className="h-4 bg-muted/70 rounded w-1/3" />
                  <div className="h-3.5 bg-muted/50 rounded w-1/2" />
                  <div className="h-3 bg-muted/40 rounded w-2/3" />
                </div>
              ))
            ) : items.length === 0 ? (
              <EmptyState
                icon={BookUser}
                title="地址簿暂无条目"
                description="可点击新建条目，或在受控设备列表中勾选设备后一键批量导入"
                action={
                  <div className="flex items-center gap-2 justify-center">
                    <Button size="sm" onClick={openCreateDialog} className="text-xs">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      新建条目
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (window.location.hash = '#/peers')}
                      className="text-xs"
                    >
                      <Monitor className="mr-1 h-3.5 w-3.5" />
                      受控设备
                    </Button>
                  </div>
                }
              />
            ) : (
              items.map((item) => {
                const isShowPwd = showPasswordMap[item.row_id]
                return (
                  <div
                    key={`mobile-ab-${item.row_id}`}
                    className="rounded-lg border bg-card p-3.5 space-y-2.5 hover:bg-muted/10 transition-colors"
                  >
                    {/* 顶部别名与操作 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm truncate" title={item.alias || item.id}>
                            {item.alias || item.id}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                            {item.platform || 'General'}
                          </Badge>
                        </div>
                        {item.hostname && (
                          <span className="text-xs text-muted-foreground truncate block mt-0.5" title={item.hostname}>
                            主机: {item.hostname}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 gap-1 cursor-pointer"
                          onClick={() => openEditDialog(item)}
                          aria-label="编辑条目"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>编辑</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                          onClick={() => setDeleteId(item.row_id)}
                          aria-label="删除条目"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* 设备 ID 与快捷复制 */}
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-mono truncate">
                        <span className="text-muted-foreground shrink-0">设备 ID:</span>
                        <span className="font-semibold text-foreground select-all truncate">{item.id}</span>
                      </div>
                      <CopyButton text={item.id} label="设备 ID" className="h-6 w-6 shrink-0" />
                    </div>

                    {/* 密码展示与快捷复制 */}
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-mono truncate">
                        <span className="text-muted-foreground shrink-0">访问密码:</span>
                        {item.password ? (
                          <span className="select-all truncate font-semibold">
                            {isShowPwd ? item.password : '••••••••'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">未预设</span>
                        )}
                      </div>
                      {item.password && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => togglePasswordVisibility(item.row_id)}
                            title={isShowPwd ? '隐藏密码' : '显示密码'}
                            aria-label={isShowPwd ? '隐藏密码' : '显示密码'}
                          >
                            {isShowPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => {
                              navigator.clipboard.writeText(item.password || '')
                              toast.success('已复制访问密码')
                            }}
                            title="复制密码"
                            aria-label="复制密码"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* 关联标签 */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t">
                        {item.tags.map((t) => (
                          <Badge
                            key={`mobile-item-tag-${item.row_id}-${t}`}
                            variant="outline"
                            className="gap-1 text-[11px] font-medium border bg-muted/40 text-foreground"
                          >
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={getTagDotByName(t)} />
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* 分页控制 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-4 sm:px-6 py-3.5 text-xs text-muted-foreground">
            <div>
              共计 <span className="font-semibold text-foreground">{total}</span> 个地址簿条目
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs cursor-pointer"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                aria-label="上一页"
              >
                上一页
              </Button>
              <span className="font-medium text-foreground">
                第 {page} / {totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs cursor-pointer"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                aria-label="下一页"
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 新增 / 编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑地址簿条目' : '新建地址簿条目'}</DialogTitle>
            <DialogDescription>维护目标客户端的快速连接凭据与识别标识</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="item-id">
                设备 ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-id"
                placeholder="例如：9 位纯数字 ID"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                disabled={!!editingItem}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-alias">别名</Label>
                <Input
                  id="item-alias"
                  placeholder="例如：家庭电脑"
                  value={formAlias}
                  onChange={(e) => setFormAlias(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="item-platform">平台系统</Label>
                <Input
                  id="item-platform"
                  placeholder="Windows / Linux / macOS"
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-hostname">主机名</Label>
              <Input
                id="item-hostname"
                placeholder="例如：WORKSTATION-01"
                value={formHostname}
                onChange={(e) => setFormHostname(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-password">固定访问密码</Label>
              <Input
                id="item-password"
                type="password"
                placeholder="预设连接密码（选填）"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>关联分类标签</Label>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-1">
                  暂无可选标签，可先前往“标签管理”创建
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-28 overflow-y-auto scrollbar-thin">
                  {tags.map((t) => {
                    const isChecked = formSelectedTags.includes(t.name)
                    return (
                      <Badge
                        key={t.id}
                        variant={isChecked ? 'default' : 'outline'}
                        className={`cursor-pointer transition-all select-none text-xs py-1 px-2.5 ${
                          isChecked ? 'shadow-xs' : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          if (isChecked) {
                            setFormSelectedTags(formSelectedTags.filter((x) => x !== t.name))
                          } else {
                            setFormSelectedTags([...formSelectedTags, t.name])
                          }
                        }}
                      >
                        {t.name}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存条目
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除地址簿条目？</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将该条目从个人地址簿中移除吗？此操作不会影响受控机器本身的运行与心跳上报。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
