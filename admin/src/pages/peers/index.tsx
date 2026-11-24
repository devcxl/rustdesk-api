import {
  BookPlus,
  Edit2,
  Info,
  Loader2,
  Monitor,
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
  StatusBadge,
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
import { formatTimestamp } from '@/lib/format'
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
  const [nowUnix, setNowUnix] = React.useState(() => Math.floor(Date.now() / 1000))

  // 别名编辑弹窗
  const [editPeer, setEditPeer] = React.useState<Peer | null>(null)
  const [editAlias, setEditAlias] = React.useState('')
  const [submittingEdit, setSubmittingEdit] = React.useState(false)

  // 详情弹窗
  const [detailPeer, setDetailPeer] = React.useState<Peer | null>(null)

  // 删除确认
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)

  const loadPeers = React.useCallback(async () => {
    try {
      setLoading(true)
      setNowUnix(Math.floor(Date.now() / 1000))
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
  }, [page, search])

  React.useEffect(() => {
    queueMicrotask(() => {
      void loadPeers()
    })
  }, [loadPeers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    void loadPeers()
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
        row_id: editPeer.row_id,
        alias: editAlias,
      })
      toast.success('设备别名已更新')
      setEditPeer(null)
      void loadPeers()
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
      void loadPeers()
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <PageHeader
        title="受控设备管理"
        description="查看向当前服务器上报心跳的 RustDesk 设备，支持别名维护与一键导入地址簿"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPeers()}
              disabled={loading}
              className="gap-1.5 cursor-pointer"
              aria-label="刷新受控设备列表"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchImportAddressBook}
              disabled={selectedIds.length === 0}
              className="gap-1.5 cursor-pointer"
              aria-label="导入所选设备到地址簿"
            >
              <BookPlus className="h-4 w-4" />
              <span>导入地址簿 ({selectedIds.length})</span>
            </Button>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteTarget({ kind: 'batch' })}
                className="gap-1.5 cursor-pointer"
                aria-label="批量删除所选设备"
              >
                <Trash2 className="h-4 w-4" />
                <span>批量删除 ({selectedIds.length})</span>
              </Button>
            )}
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
              aria-label="搜索设备"
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
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={peers.length > 0 && selectedIds.length === peers.length}
                      onCheckedChange={(c) => handleSelectAll(!!c)}
                      aria-label="全选所有设备"
                    />
                  </TableHead>
                  <TableHead className="w-36">设备 ID</TableHead>
                  <TableHead>别名 / 备注</TableHead>
                  <TableHead className="hidden sm:table-cell">主机名</TableHead>
                  <TableHead className="hidden lg:table-cell">平台 / 系统</TableHead>
                  <TableHead className="hidden lg:table-cell">客户端版本</TableHead>
                  <TableHead className="hidden lg:table-cell">上报 IP</TableHead>
                  <TableHead className="w-36">状态 / 心跳</TableHead>
                  <TableHead className="text-right pr-6 w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && peers.length === 0 ? (
                  <TableSkeleton columns={9} rows={5} />
                ) : peers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-48 text-center p-0">
                      <EmptyState
                        icon={Monitor}
                        title="暂无上报的受控设备"
                        description={
                          search
                            ? '没有找到符合当前搜索条件的受控设备'
                            : '在客户端配置服务端地址后，受控设备将自动向此服务上报心跳'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  peers.map((peer) => {
                    const isOnline = nowUnix - peer.last_online_time < 300
                    const isSelected = selectedIds.includes(peer.row_id)
                    return (
                      <TableRow
                        key={peer.row_id}
                        data-state={isSelected ? 'selected' : undefined}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(c) => handleSelectOne(peer.row_id, !!c)}
                            aria-label={`选择设备 ${peer.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                            <span className="truncate" title={peer.id}>
                              {peer.id}
                            </span>
                            <CopyButton
                              text={peer.id}
                              label="设备 ID"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-medium text-foreground truncate block max-w-[140px]"
                            title={peer.alias || '-'}
                          >
                            {peer.alias || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          <span
                            className="truncate block max-w-[120px]"
                            title={peer.hostname || '-'}
                          >
                            {peer.hostname || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline" className="font-mono text-[11px] font-normal">
                            {peer.os || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {peer.version || '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          <span className="truncate block max-w-[110px]" title={peer.last_online_ip || '-'}>
                            {peer.last_online_ip || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge online={isOnline} />
                            <span className="text-[10px] text-muted-foreground truncate" title={formatTimestamp(peer.last_online_time)}>
                              {formatTimestamp(peer.last_online_time)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="详细信息"
                              aria-label="查看详细信息"
                              onClick={() => setDetailPeer(peer)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="修改别名"
                              aria-label="修改别名"
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
                              aria-label="删除设备"
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
          </div>

          {/* 移动端卡片视图 (md 以下显示) */}
          <div className="xl:hidden p-3 space-y-3">
            {loading && peers.length === 0 ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={`peer-skel-${idx}`} className="rounded-lg border bg-card p-3.5 space-y-2.5 animate-pulse">
                  <div className="h-4 bg-muted/70 rounded w-1/3" />
                  <div className="h-3.5 bg-muted/50 rounded w-1/2" />
                  <div className="h-3 bg-muted/40 rounded w-2/3" />
                </div>
              ))
            ) : peers.length === 0 ? (
              <EmptyState
                icon={Monitor}
                title="暂无上报的受控设备"
                description={
                  search
                    ? '没有找到符合当前搜索条件的受控设备'
                    : '在客户端配置服务端地址后，受控设备将自动向此服务上报心跳'
                }
              />
            ) : (
              <>
                <div className="flex items-center justify-between px-1 py-0.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={peers.length > 0 && selectedIds.length === peers.length}
                      onCheckedChange={(c) => handleSelectAll(!!c)}
                      id="select-all-mobile"
                      aria-label="全选本页所有设备"
                    />
                    <label htmlFor="select-all-mobile" className="cursor-pointer font-medium text-foreground select-none">
                      全选本页设备
                    </label>
                  </div>
                  {selectedIds.length > 0 && (
                    <span className="font-semibold text-primary">已选 {selectedIds.length} 台</span>
                  )}
                </div>

                {peers.map((peer) => {
                  const isOnline = nowUnix - peer.last_online_time < 300
                  const isSelected = selectedIds.includes(peer.row_id)
                  const displayName = peer.alias || peer.hostname || peer.id
                  return (
                    <div
                      key={`mobile-peer-${peer.row_id}`}
                      className={`rounded-lg border bg-card p-3.5 space-y-2.5 transition-colors ${
                        isSelected
                          ? 'border-primary ring-1 ring-primary/30 bg-muted/15'
                          : 'hover:bg-muted/10'
                      }`}
                    >
                      {/* 顶部标题与状态 */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(c) => handleSelectOne(peer.row_id, !!c)}
                            aria-label={`选择设备 ${peer.id}`}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground text-sm truncate block" title={displayName}>
                              {displayName}
                            </span>
                            {peer.alias && peer.hostname && (
                              <span className="text-xs text-muted-foreground truncate block" title={peer.hostname}>
                                主机: {peer.hostname}
                              </span>
                            )}
                          </div>
                        </div>
                        <StatusBadge online={isOnline} className="shrink-0" />
                      </div>

                      {/* 设备 ID 与快捷复制 */}
                      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-mono truncate">
                          <span className="text-muted-foreground shrink-0">ID:</span>
                          <span className="font-semibold text-foreground select-all truncate">{peer.id}</span>
                        </div>
                        <CopyButton text={peer.id} label="设备 ID" className="h-6 w-6 shrink-0" />
                      </div>

                      {/* 系统与连接元数据 */}
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground font-mono">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                            {peer.os || 'Unknown'}
                          </Badge>
                          {peer.version && (
                            <span className="text-[11px] text-muted-foreground">{peer.version}</span>
                          )}
                          {peer.last_online_ip && (
                            <span className="text-[11px] text-muted-foreground">• {peer.last_online_ip}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-sans" title={formatTimestamp(peer.last_online_time)}>
                          {formatTimestamp(peer.last_online_time)}
                        </span>
                      </div>

                      {/* 底部操作栏 */}
                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5 gap-1 cursor-pointer"
                          onClick={() => setDetailPeer(peer)}
                          aria-label="查看详细参数"
                        >
                          <Info className="h-3.5 w-3.5" />
                          <span>参数详情</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5 gap-1 cursor-pointer"
                          onClick={() => {
                            setEditPeer(peer)
                            setEditAlias(peer.alias || '')
                          }}
                          aria-label="修改备注别名"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>修改别名</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs px-2 gap-1 text-muted-foreground hover:text-destructive cursor-pointer"
                          onClick={() => setDeleteTarget({ kind: 'single', rowId: peer.row_id })}
                          aria-label="删除设备"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>删除</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* 分页控制 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-4 sm:px-6 py-3.5 text-xs text-muted-foreground">
            <div>
              共计 <span className="font-semibold text-foreground">{total}</span> 台设备
              {selectedIds.length > 0 && (
                <span className="ml-2 font-medium text-primary">
                  （已勾选 {selectedIds.length} 项）
                </span>
              )}
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

      {/* 修改设备别名弹窗 */}
      <Dialog open={!!editPeer} onOpenChange={(open) => !open && setEditPeer(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改设备别名</DialogTitle>
            <DialogDescription>
              为设备 ID: <code className="font-mono font-semibold text-foreground">{editPeer?.id}</code> 设置易于识别的别名或备注。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="alias">别名 / 备注</Label>
              <Input
                id="alias"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                placeholder="例如：办公室工作站 / 广州机房测试机"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>设备详细信息</DialogTitle>
            <DialogDescription>查看设备上报的硬件与环境配置参数</DialogDescription>
          </DialogHeader>
          {detailPeer && (
            <div className="space-y-2.5 py-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">设备 ID</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-semibold">{detailPeer.id}</span>
                  <CopyButton text={detailPeer.id} label="设备 ID" className="h-6 w-6" />
                </div>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">主机名</span>
                <span className="font-medium">{detailPeer.hostname || '-'}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">操作系统</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {detailPeer.os || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">客户端版本</span>
                <span className="font-mono">{detailPeer.version || '-'}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">CPU 信息</span>
                <span className="text-right truncate max-w-[220px]" title={detailPeer.cpu}>
                  {detailPeer.cpu || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">内存容量</span>
                <span>{detailPeer.memory || '-'}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">上报连接 IP</span>
                <div className="flex items-center gap-1 font-mono">
                  <span>{detailPeer.last_online_ip || '-'}</span>
                  {detailPeer.last_online_ip && (
                    <CopyButton
                      text={detailPeer.last_online_ip}
                      label="IP 地址"
                      className="h-6 w-6"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pb-1">
                <span className="text-muted-foreground">最后心跳时间</span>
                <span>{formatTimestamp(detailPeer.last_online_time)}</span>
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
            <AlertDialogTitle>确认删除设备？</AlertDialogTitle>
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
