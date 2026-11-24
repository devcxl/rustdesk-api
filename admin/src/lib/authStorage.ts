const AUTO_REDIRECT_AT_KEY = 'rustdesk_admin_autologin_at'
const NO_AUTO_REDIRECT_KEY = 'rustdesk_admin_no_auto'
const AUTO_REDIRECT_COOLDOWN_MS = 5 * 60 * 1000

export function suppressAutoLogin(): void {
  sessionStorage.setItem(NO_AUTO_REDIRECT_KEY, '1')
}

export function clearAutoLoginSuppression(): void {
  sessionStorage.removeItem(NO_AUTO_REDIRECT_KEY)
}

export function canAutoRedirect(): boolean {
  if (sessionStorage.getItem(NO_AUTO_REDIRECT_KEY) === '1') {
    return false
  }
  const attemptedAt = Number(sessionStorage.getItem(AUTO_REDIRECT_AT_KEY) || 0)
  return !attemptedAt || Date.now() - attemptedAt > AUTO_REDIRECT_COOLDOWN_MS
}

export function markAutoRedirect(): void {
  sessionStorage.setItem(AUTO_REDIRECT_AT_KEY, String(Date.now()))
}

export function clearAutoRedirectState(): void {
  sessionStorage.removeItem(AUTO_REDIRECT_AT_KEY)
  sessionStorage.removeItem(NO_AUTO_REDIRECT_KEY)
}
