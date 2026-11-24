import type { CSSProperties } from 'react'

/**
 * 格式化 Unix 时间戳 (秒) 为可读本地日期时间字符串
 */
export function formatTimestamp(ts?: number): string {
  if (!ts || ts <= 0) return '从未连接'
  const date = new Date(ts * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(ts: number, currentUnixSeconds?: number): string {
  if (!ts || ts <= 0) return '从未连接'
  const now = currentUnixSeconds ?? Math.floor(Date.now() / 1000)
  const diff = Math.max(0, now - ts)

  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return formatTimestamp(ts)
}

/**
 * 将整型颜色值转换为 #RRGGBB 格式十六进制字符串
 */
export function colorToHex(colorNum: number): string {
  return '#' + (colorNum & 0x00ffffff).toString(16).padStart(6, '0')
}

/**
 * 标签色点样式：芯片文本保持主题前景色，只用色点表达颜色，
 * 避免任意标签色在明暗主题下达不到对比度要求。
 */
export function getTagDotStyle(colorNum?: number): CSSProperties {
  if (colorNum === undefined || colorNum === null) return {}
  return { backgroundColor: colorToHex(colorNum) }
}
