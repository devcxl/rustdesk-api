import {
  Check,
  Edit2,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
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
import type { Tag } from '@/types/api'

// 精选 Shadcn 风格高雅配色预设
const PRESET_COLORS = [
  { name: '天空蓝', hex: '#0284c7', num: 0xff0284c7 },
  { name: '宝石蓝', hex: '#2563eb', num: 0xff2563eb },
  { name: '极光青', hex: '#0d9488', num: 0xff0d9488 },
  { name: '翡翠绿', hex: '#16a34a', num: 0xff16a34a },
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

  React.useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
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
  }

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
      loadTags()
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
      loadTags()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    } finally {
      setDeleteId(null)
    }
  }

  const colorToHex = (colorNum: number) => {
    return '#' + (colorNum & 0x00ffffff).toString(16).padStart(6, '0')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">标签管理</h1>
          <p className="text-sm text-muted-foreground">
            设置用于受控设备与地址簿条目的色彩分类标记
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTags}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" onClick={openCreateDialog} className="gap-1.5">
            <Plus className="h-4 w-4" />
            新建标签
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标签 ID</TableHead>
                <TableHead>标签名称</TableHead>
                <TableHead>色彩预览</TableHead>
                <TableHead>颜色值 (Hex)</TableHead>
                <TableHead className="text-right pr-6">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-36 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span>正在加载标签...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-36 text-center text-muted-foreground text-sm">
                    暂无标签，点击右上角新建标签
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => {
                  const hex = colorToHex(tag.color)
                  return (
                    <TableRow key={tag.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{tag.id}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-medium text-xs px-2.5 py-1"
                          style={{
                            backgroundColor: hex + '20',
                            color: hex,
                            borderColor: hex + '50',
                          }}
                        >
                          {tag.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-5 w-5 rounded-full border shadow-xs"
                            style={{ backgroundColor: hex }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {hex.toUpperCase()}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(tag)}
                            title="编辑"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(tag.id)}
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

          <div className="border-t px-6 py-4 text-xs text-muted-foreground">
            共计 <span className="font-medium text-foreground">{total}</span> 个标签
          </div>
        </CardContent>
      </Card>

      {/* 新增/编辑标签弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTag ? '编辑标签' : '新建标签'}</DialogTitle>
            <DialogDescription>创建或修改标签属性，赋予直观的色彩分类</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name">
                标签名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tag-name"
                placeholder="例如：生产服务器 / 个人设备 / 局域网"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span>选择标签颜色</span>
              </Label>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {PRESET_COLORS.map((c) => {
                  const isSelected = formColor === c.num
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      className={`flex items-center justify-between gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-accent'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setFormColor(c.num)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full border shadow-xs"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="truncate">{c.name}</span>
                      </div>
                      {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
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
                className="font-medium text-xs px-2.5 py-1"
                style={{
                  backgroundColor: colorToHex(formColor) + '20',
                  color: colorToHex(formColor),
                  borderColor: colorToHex(formColor) + '50',
                }}
              >
                {formName.trim() || '示例标签'}
              </Badge>
            </div>
          </div>
          <DialogFooter>
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
              确定要删除此标签吗？已绑定该标签的地址簿条目将不再显示此标签标识。
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
