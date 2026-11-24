import {
  Check,
  Edit2,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Tags,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import {
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
import { Card, CardContent } from '@/components/ui/card'
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
import { colorToHex, getTagDotStyle } from '@/lib/format'
import type { Tag } from '@/types/api'

// 精选基础设施高对比度配色预设
const PRESET_COLORS = [
  { name: '天空蓝', hex: '#0284c7', num: 0xff0284c7 },
  { name: '宝石蓝', hex: '#2563eb', num: 0xff2563eb },
  { name: '翡翠绿', hex: '#059669', num: 0xff059669 },
  { name: '极光青', hex: '#0d9488', num: 0xff0d9488 },
  { name: '琥珀橙', hex: '#d97706', num: 0xffd97706 },
  { name: '烈焰红', hex: '#dc2626', num: 0xffdc2626 },
  { name: '神秘紫', hex: '#9333ea', num: 0xff9333ea },
  { name: '深石灰', hex: '#4b5563', num: 0xff4b5563 },
]

export function TagsPage() {
  const [loading, setLoading] = React.useState(false)
  const [tags, setTags] = React.useState<Tag[]>([])
  const [total, setTotal] = React.useState(0)

  // 新增/编辑弹窗
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingTag, setEditingTag] = React.useState<Tag | null>(null)
  const [formName, setFormName] = React.useState('')
  const [formColor, setFormColor] = React.useState(PRESET_COLORS[0].num)
  const [submitting, setSubmitting] = React.useState(false)

  // 删除确认
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  const loadTags = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.tags.getList({ page: 1, page_size: 100 })
      setTags(res.list || [])
      setTotal(res.total || 0)
    } catch (err: any) {
      toast.error(err.message || '加载标签失败')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    queueMicrotask(() => {
      void loadTags()
    })
  }, [loadTags])

  const openCreateDialog = () => {
    setEditingTag(null)
    setFormName('')
    setFormColor(PRESET_COLORS[0].num)
    setDialogOpen(true)
  }

  const openEditDialog = (tag: Tag) => {
    setEditingTag(tag)
    setFormName(tag.name)
    setFormColor(tag.color || PRESET_COLORS[0].num)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('标签名称不能为空')
      return
    }

    try {
      setSubmitting(true)
      if (editingTag) {
        await api.tags.update({
          id: editingTag.id,
          name: formName.trim(),
          color: formColor,
        })
        toast.success('标签已更新')
      } else {
        await api.tags.create({
          name: formName.trim(),
          color: formColor,
        })
        toast.success('标签已创建')
      }
      setDialogOpen(false)
      void loadTags()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    try {
      await api.tags.delete(deleteId)
      toast.success('标签已删除')
      void loadTags()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="标签管理"
        description="设置用于受控设备与地址簿条目的色彩分类标记"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadTags()}
              disabled={loading}
              className="gap-1.5 cursor-pointer"
              aria-label="刷新标签列表"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </Button>
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="gap-1.5 cursor-pointer"
              aria-label="新建标签"
            >
              <Plus className="h-4 w-4" />
              <span>新建标签</span>
            </Button>
          </>
        }
      />

      <Card className="shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {/* 桌面端表格视图 (md 及以上显示) */}
          <div className="hidden xl:block w-full overflow-x-auto scrollbar-thin">
            <Table className="min-w-[550px]">
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="hidden sm:table-cell w-24">标签 ID</TableHead>
                  <TableHead>标签名称与样式</TableHead>
                  <TableHead className="w-32">色彩样例</TableHead>
                  <TableHead className="hidden lg:table-cell w-36">颜色值 (Hex)</TableHead>
                  <TableHead className="text-right pr-6 w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && tags.length === 0 ? (
                  <TableSkeleton columns={5} rows={4} />
                ) : tags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center p-0">
                      <EmptyState
                        icon={Tags}
                        title="暂无标签"
                        description="点击右上角新建标签，赋予受控设备与地址簿条目直观的色彩分类"
                        action={
                          <Button size="sm" onClick={openCreateDialog} className="text-xs">
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            新建第一个标签
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  tags.map((tag) => {
                    const hex = colorToHex(tag.color)
                    return (
                      <TableRow key={tag.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                          #{tag.id}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="gap-1.5 font-medium text-xs px-2.5 py-0.5 border bg-muted/40 text-foreground"
                          >
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={getTagDotStyle(tag.color)} />
                            {tag.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-4 rounded-full border shadow-xs shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {PRESET_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name || '自定义'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {hex.toUpperCase()}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditDialog(tag)}
                              title="编辑标签"
                              aria-label="编辑标签"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteId(tag.id)}
                              title="删除标签"
                              aria-label="删除标签"
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
          <div className="xl:hidden p-3 space-y-2.5">
            {loading && tags.length === 0 ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={`tag-skel-${idx}`} className="rounded-lg border bg-card p-3.5 space-y-2 animate-pulse">
                  <div className="h-4 bg-muted/70 rounded w-1/4" />
                  <div className="h-3 bg-muted/50 rounded w-1/2" />
                </div>
              ))
            ) : tags.length === 0 ? (
              <EmptyState
                icon={Tags}
                title="暂无标签"
                description="点击右上角新建标签，赋予受控设备与地址簿条目直观的色彩分类"
                action={
                  <Button size="sm" onClick={openCreateDialog} className="text-xs">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    新建第一个标签
                  </Button>
                }
              />
            ) : (
              tags.map((tag) => {
                const hex = colorToHex(tag.color)
                const colorName =
                  PRESET_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name || '自定义'
                return (
                  <div
                    key={`mobile-tag-${tag.id}`}
                    className="rounded-lg border bg-card p-3.5 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <Badge
                        variant="outline"
                        className="gap-1.5 font-medium text-xs px-2.5 py-0.5 border bg-muted/40 text-foreground"
                      >
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={getTagDotStyle(tag.color)} />
                        {tag.name}
                      </Badge>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div
                          className="h-3.5 w-3.5 rounded-full border shadow-xs shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="truncate">{colorName}</span>
                        <span className="font-mono text-[11px] uppercase text-muted-foreground">{hex}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">#{tag.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs px-2.5 gap-1 cursor-pointer"
                        onClick={() => openEditDialog(tag)}
                        aria-label="编辑标签"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>编辑</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={() => setDeleteId(tag.id)}
                        aria-label="删除标签"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="border-t px-4 sm:px-6 py-3.5 text-xs text-muted-foreground">
            共计 <span className="font-semibold text-foreground">{total}</span> 个分类标签
          </div>
        </CardContent>
      </Card>

      {/* 新增/编辑标签弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTag ? '编辑标签' : '新建标签'}</DialogTitle>
            <DialogDescription>创建或修改标签属性，赋予直观易辨的色彩分类</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tag-name">
                标签名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tag-name"
                placeholder="例如：生产环境 / 个人机房 / 临时设备"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                <span>选择标签基调色</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                {PRESET_COLORS.map((c) => {
                  const isSelected = formColor === c.num
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={`选择颜色: ${c.name}`}
                      className={`flex items-center justify-between gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-muted/80'
                          : 'hover:bg-muted/50 border-border'
                      }`}
                      onClick={() => setFormColor(c.num)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-3.5 w-3.5 rounded-full border shadow-xs shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="truncate">{c.name}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 效果实时预览 */}
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">实时效果预览：</span>
              <Badge
                variant="outline"
                className="gap-1.5 font-medium text-xs px-2.5 py-0.5 border bg-muted/40 text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={getTagDotStyle(formColor)} />
                {formName.trim() || '示例标签'}
              </Badge>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存标签
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
            <AlertDialogTitle>确认删除该标签？</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此标签吗？已绑定该标签的受控设备与地址簿条目将不再显示此标签标识。
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
