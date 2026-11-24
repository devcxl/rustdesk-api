import { Check, Copy } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  text: string
  label?: string
  showText?: boolean
  successDuration?: number
}

export function CopyButton({
  text,
  label,
  showText = false,
  successDuration = 2000,
  className,
  variant = 'ghost',
  size = 'icon',
  children,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(`已复制 ${label || '内容'} 到剪贴板`)
    setTimeout(() => setCopied(false), successDuration)
  }

  const ariaLabel = copied
    ? `已复制 ${label || text}`
    : `复制 ${label || text}`

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('shrink-0 cursor-pointer', className)}
      onClick={handleCopy}
      aria-label={ariaLabel}
      title={label ? `复制${label}` : '复制'}
      {...props}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {showText && (
        <span className="ml-1 text-xs">{copied ? '已复制' : children || '复制'}</span>
      )}
    </Button>
  )
}
