import { Loader2 } from 'lucide-react'

import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface TableSkeletonProps {
  columns: number
  rows?: number
  className?: string
}

export function TableSkeleton({
  columns,
  rows = 5,
  className,
}: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <TableRow key={`skeleton-row-${rIdx}`} className={cn('hover:bg-transparent', className)}>
          {Array.from({ length: columns }).map((_, cIdx) => (
            <TableCell key={`skeleton-cell-${rIdx}-${cIdx}`} className="py-3.5">
              <div
                className={cn(
                  'h-4 rounded bg-muted/70 animate-pulse',
                  cIdx === 0 && 'w-8',
                  cIdx === 1 && 'w-24',
                  cIdx > 1 && 'w-3/4'
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function LoadingState({
  text = '正在加载数据...',
  className,
}: {
  text?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 gap-2.5 text-muted-foreground text-sm',
        className
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-xs">{text}</span>
    </div>
  )
}
