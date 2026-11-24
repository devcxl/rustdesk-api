import { cn } from '@/lib/utils'

export interface StatusBadgeProps {
  online: boolean
  label?: string
  className?: string
}

export function StatusBadge({ online, label, className }: StatusBadgeProps) {
  const displayLabel = label ?? (online ? '在线' : '离线')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border transition-colors',
        online
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'border-border bg-muted/50 text-muted-foreground',
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full shrink-0',
          online ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-muted-foreground/50'
        )}
      />
      <span>{displayLabel}</span>
    </span>
  )
}
