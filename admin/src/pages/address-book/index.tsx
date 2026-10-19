import {
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

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

  React.useEffect(() => {
    loadTags()
  }, [])

  React.useEffect(() => {
    loadAddressBook()
  }, [page])

  const loadTags = async () => {
    try {
      const res = await api.tags.getList({ page: 1, page_size: 100 })
      setTags(res.list || [])
    } catch {
      // ignore
    }
  }

  const loadAddressBook = async () => {
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
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadAddressBook()
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
      loadAddressBook()
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
      loadAddressBook()
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

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`已复制 ${label}`)
  }

  const getTagColorStyle = (tagName: string) => {
    const matched = tags.find((t) => t.name === tagName)
    if (!matched || !matched.color) return {}
    const hex = '#' + (matched.color & 0x00ffffff).toString(16).padStart(6, '0')
    return {
      backgroundColor: hex + '20',
      color: hex,
      borderColor: hex + '50',
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">地址簿管理</h1>
          <p className="text-sm text-muted-foreground">
            双向同步至 RustDesk 各客户端的个人受控设备地址簿与访问凭据
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAddressBook}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" onClick={openCreateDialog} className="gap-1.5">
            <Plus className="h-4 w-4" />
            新建条目
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
            <Input
              placeholder="搜索主机名或ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
            <Button type="submit" size="sm" variant="secondary" className="gap-1">
              <Search className="h-4 w-4" />
              搜索
            </Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>设备 ID</TableHead>
                <TableHead>别名</TableHead>
                <TableHead>主机名</TableHead>
                <TableHead>平台</TableHead>
                <TableHead>标签分类</TableHead>
                <TableHead>访问密码</TableHead>
                <TableHead className="text-right pr-6">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span>正在加载地址簿...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center text-muted-foreground text-sm">
                    地址簿暂无条目，可点击右上角新建或在“受控设备”中批量导入
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isShowPwd = showPasswordMap[item.row_id]
                  return (
                    <TableRow key={item.row_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{item.id}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => copyText(item.id, '设备 ID')}
                            title="复制 ID"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {item.alias || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.hostname || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.platform || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.tags && item.tags.length > 0 ? (
                            item.tags.map((t) => (
                              <Badge
                                key={t}
                                variant="outline"
                                className="text-xs font-normal"
                                style={getTagColorStyle(t)}
                              >
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
                            <span>{isShowPwd ? item.password : '••••••••'}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground"
                              onClick={() => togglePasswordVisibility(item.row_id)}
                              title={isShowPwd ? '隐藏密码' : '显示密码'}
                            >
                              {isShowPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground"
                              onClick={() => copyText(item.password || '', '密码')}
                              title="复制密码"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">未预设</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(item)}
                            title="编辑"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(item.row_id)}
                            title="删除"
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

          {/* 分页控制 */}
          <div className="flex items-center justify-between border-t px-6 py-4 text-xs text-muted-foreground">
            <div>
              共计 <span className="font-medium text-foreground">{total}</span> 个地址簿条目
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </Button>
              <span>第 {page} 页</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 新增 / 编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑地址簿条目' : '新建地址簿条目'}</DialogTitle>
            <DialogDescription>维护目标客户端的快速连接凭据与识别标识</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="item-id">
                设备 ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-id"
                placeholder="例如：9 位纯数字"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                disabled={!!editingItem}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-alias">别名</Label>
              <Input
                id="item-alias"
                placeholder="例如：家庭工作站"
                value={formAlias}
                onChange={(e) => setFormAlias(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-hostname">主机名</Label>
              <Input
                id="item-hostname"
                placeholder="例如：DESKTOP-ABC123"
                value={formHostname}
                onChange={(e) => setFormHostname(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-password">固定访问密码</Label>
              <Input
                id="item-password"
                type="password"
                placeholder="预设连接密码（选填）"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-platform">平台</Label>
              <Input
                id="item-platform"
                placeholder="例如：Windows / Linux / macOS / Android"
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>关联标签</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => {
                  const isChecked = formSelectedTags.includes(t.name)
                  return (
                    <Badge
                      key={t.id}
                      variant={isChecked ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存
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
              确定要将该条目从个人地址簿中移除吗？这不会影响目标受控机器本身的运行。
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
