import {
  BookPlus,
  Edit2,
  Info,
  Loader2,
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
import { Checkbox } from '@/components/ui/checkbox'
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
import type { Peer } from '@/types/api'

type DeleteTarget = { kind: 'single'; rowId: number } | { kind: 'batch' }

export function PeersPage() {
  const [loading, setLoading] = React.useState(false)
  const [peers, setPeers] = React.useState<Peer[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const pageSize = 15
  const [search, setSearch] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])

  // 别名编辑弹窗
  const [editPeer, setEditPeer] = React.useState<Peer | null>(null)
  const [editAlias, setEditAlias] = React.useState('')
  const [submittingEdit, setSubmittingEdit] = React.useState(false)

  // 详情弹窗
  const [detailPeer, setDetailPeer] = React.useState<Peer | null>(null)

  // 删除确认
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)

  React.useEffect(() => {
    loadPeers()
  }, [page])

  const loadPeers = async () => {
    try {
      setLoading(true)
      const res = await api.peers.getList({
        page,
        page_size: pageSize,
        hostname: search || undefined,
      })
      setPeers(res.list || [])
      setTotal(res.total || 0)
    } catch (err: any) {
      toast.error(err.message || '加载设备失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadPeers()
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(peers.map((p) => p.row_id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id])
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const handleSaveAlias = async () => {
    if (!editPeer) return
    try {
      setSubmittingEdit(true)
      await api.peers.update({
        id: editPeer.id,
        alias: editAlias,
      })
      toast.success('设备别名已更新')
      setEditPeer(null)
      loadPeers()
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleConfirmDelete = async () => {
    try {
      if (deleteTarget?.kind === 'batch') {
        if (selectedIds.length === 0) return
        await api.peers.batchDelete(selectedIds)
        toast.success(`已批量删除 ${selectedIds.length} 台设备`)
        setSelectedIds([])
      } else if (deleteTarget?.kind === 'single') {
        await api.peers.delete(deleteTarget.rowId)
        toast.success('设备已删除')
      }
      loadPeers()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleBatchImportAddressBook = async () => {
    if (selectedIds.length === 0) {
      toast.info('请先勾选需要导入地址簿的设备')
      return
    }
    try {
      await api.addressBook.batchCreateFromPeers(selectedIds)
      toast.success(`已将 ${selectedIds.length} 台设备一键导入到地址簿`)
      setSelectedIds([])
    } catch (err: any) {
      toast.error(err.message || '导入地址簿失败')
    }
  }

  const formatTime = (ts: number) => {
    if (!ts) return '从未连接'
    return new Date(ts * 1000).toLocaleString('zh-CN', {
      hour12: false,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">受控设备管理</h1>
          <p className="text-sm text-muted-foreground">
            查看向当前服务器上报心跳的 RustDesk 设备，支持别名维护与一键导入地址簿
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPeers}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchImportAddressBook}
            disabled={selectedIds.length === 0}
            className="gap-1.5"
          >
            <BookPlus className="h-4 w-4" />
            导入地址簿 ({selectedIds.length})
          </Button>
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTarget({ kind: 'batch' })}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              批量删除 ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
            <Input
              placeholder="搜索设备名称或ID..."
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
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={peers.length > 0 && selectedIds.length === peers.length}
                    onCheckedChange={(c) => handleSelectAll(!!c)}
                  />
                </TableHead>
                <TableHead>设备 ID</TableHead>
                <TableHead>别名 / 备注</TableHead>
                <TableHead>主机名</TableHead>
                <TableHead>平台 / 系统</TableHead>
                <TableHead>客户端版本</TableHead>
                <TableHead>公网 / 局域网 IP</TableHead>
                <TableHead>状态 / 最后心跳</TableHead>
                <TableHead className="text-right pr-6">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && peers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-36 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span>正在加载设备数据...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : peers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-36 text-center text-muted-foreground text-sm">
                    暂无上报的受控设备
                  </TableCell>
                </TableRow>
              ) : (
                peers.map((peer) => {
                  const now = Math.floor(Date.now() / 1000)
                  const isOnline = now - peer.last_online_time < 300
                  const isSelected = selectedIds.includes(peer.row_id)
                  return (
                    <TableRow key={peer.row_id} data-state={isSelected ? 'selected' : undefined}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(c) => handleSelectOne(peer.row_id, !!c)}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{peer.id}</TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">
                          {peer.alias || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{peer.hostname || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {peer.os || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {peer.version || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {peer.last_online_ip || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
                              }`}
                            />
                            <span className="text-xs font-medium">
                              {isOnline ? '在线' : '离线'}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {formatTime(peer.last_online_time)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="详细信息"
                            onClick={() => setDetailPeer(peer)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="修改别名"
                            onClick={() => {
                              setEditPeer(peer)
                              setEditAlias(peer.alias || '')
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="删除设备"
                            onClick={() =>
                              setDeleteTarget({ kind: 'single', rowId: peer.row_id })
                            }
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
              共计 <span className="font-medium text-foreground">{total}</span> 台设备
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

      {/* 修改设备别名弹窗 */}
      <Dialog open={!!editPeer} onOpenChange={(open) => !open && setEditPeer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改设备别名</DialogTitle>
            <DialogDescription>
              为设备 ID: <code className="font-mono text-xs">{editPeer?.id}</code> 设置易于识别的别名或备注。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="alias">别名 / 备注</Label>
              <Input
                id="alias"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                placeholder="例如：办公室台式机 / 广州机房节点"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPeer(null)}>
              取消
            </Button>
            <Button onClick={handleSaveAlias} disabled={submittingEdit}>
              {submittingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 设备详情弹窗 */}
      <Dialog open={!!detailPeer} onOpenChange={(open) => !open && setDetailPeer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>设备详细信息</DialogTitle>
            <DialogDescription>查看设备上报的硬件与环境配置</DialogDescription>
          </DialogHeader>
          {detailPeer && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">设备 ID</span>
                <span className="font-mono font-semibold">{detailPeer.id}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">主机名</span>
                <span>{detailPeer.hostname || '-'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">操作系统</span>
                <span>{detailPeer.os || '-'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">客户端版本</span>
                <span className="font-mono">{detailPeer.version || '-'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">CPU 信息</span>
                <span className="text-right truncate max-w-[220px]" title={detailPeer.cpu}>
                  {detailPeer.cpu || '-'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">内存容量</span>
                <span>{detailPeer.memory || '-'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">最新连接 IP</span>
                <span className="font-mono">{detailPeer.last_online_ip || '-'}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-foreground">最后心跳时间</span>
                <span>{formatTime(detailPeer.last_online_time)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailPeer(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'batch'
                ? `确定要批量删除已选中的 ${selectedIds.length} 台设备记录吗？删除后相关设备下次上报心跳时将重新自动注册。`
                : '确定要删除此设备记录吗？删除后该设备下次上报心跳时将重新自动注册。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
