import type {
  AddressBook,
  AdminConfig,
  ApiResponse,
  LoginOptions,
  LoginPayload,
  PageData,
  Peer,
  ServerConfig,
  Tag,
  User,
} from '@/types/api'

const TOKEN_KEY = 'rustdesk_admin_token'

export const getToken = (): string => {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

export async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  let url = endpoint
  if (options.params) {
    const query = new URLSearchParams()
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val))
      }
    }
    const queryString = query.toString()
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  const token = getToken()
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  if (token) {
    headers.set('api-token', token)
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (res.status === 401 || res.status === 403) {
    removeToken()
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login'
    }
    throw new Error('未授权或登录已过期')
  }

  const data: ApiResponse<T> = await res.json()
  if (data.code !== 0) {
    throw new Error(data.message || '请求失败')
  }

  return data.data
}

// 业务 API
export const api = {
  login: {
    getOptions: () => request<LoginOptions>('/api/admin/login-options'),
    oidcAuth: (op = 'github') =>
      request<{ code: string; url: string }>('/api/admin/oidc/auth', {
        method: 'POST',
        body: JSON.stringify({ op }),
      }),
    oidcAuthQuery: (code: string) =>
      request<LoginPayload>('/api/admin/oidc/auth-query', {
        params: { code },
      }),
    logout: () =>
      request('/api/admin/logout', {
        method: 'POST',
      }),
  },
  user: {
    getCurrent: () => request<User>('/api/admin/user/current'),
  },
  config: {
    getServer: () => request<ServerConfig>('/api/admin/config/server'),
    getAdmin: () => request<AdminConfig>('/api/admin/config/admin'),
  },
  peers: {
    getList: (params?: { page?: number; page_size?: number; id?: string; hostname?: string }) =>
      request<PageData<Peer>>('/api/admin/peer/list', { params }),
    getDetail: (id: number | string) => request<Peer>(`/api/admin/peer/detail/${id}`),
    update: (data: { id: number | string; alias?: string }) =>
      request('/api/admin/peer/update', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: number | string) =>
      request('/api/admin/peer/delete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    batchDelete: (ids: (number | string)[]) =>
      request('/api/admin/peer/batchDelete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  },
  tags: {
    getList: (params?: { page?: number; page_size?: number }) =>
      request<PageData<Tag>>('/api/admin/tag/list', { params }),
    create: (data: { name: string; color: number }) =>
      request('/api/admin/tag/create', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (data: { id: number; name: string; color: number }) =>
      request('/api/admin/tag/update', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request('/api/admin/tag/delete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
  },
  addressBook: {
    getList: (params?: { page?: number; page_size?: number; id?: string; hostname?: string }) =>
      request<PageData<AddressBook>>('/api/admin/address_book/list', { params }),
    create: (data: Partial<AddressBook>) =>
      request('/api/admin/address_book/create', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (data: Partial<AddressBook>) =>
      request('/api/admin/address_book/update', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request('/api/admin/address_book/delete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    batchCreateFromPeers: (ids: (number | string)[]) =>
      request('/api/admin/address_book/batchCreateFromPeers', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  },
}
