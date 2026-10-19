export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PageData<T> {
  page: number
  total: number
  list: T[]
}

export interface User {
  id: number
  username: string
  nickname?: string
  email?: string
  avatar?: string
  is_admin: boolean
  status: number
  created_at?: string
  updated_at?: string
}

export interface LoginPayload {
  token: string
  user: User
  routeNames?: string[]
}

export interface LoginOptions {
  op: string[]
  register: boolean
  auto_oidc: boolean
  web_client: boolean
}

export interface ServerConfig {
  id_server: string
  key: string
  relay_server: string
  api_server: string
}

export interface AdminConfig {
  title?: string
  welcome?: string
  login_url?: string
}

export interface Peer {
  row_id: number
  id: string
  cpu?: string
  hostname: string
  memory?: string
  os: string
  username?: string
  uuid?: string
  version?: string
  user_id: number
  last_online_time: number
  last_online_ip: string
  alias?: string
  created_at?: string
  updated_at?: string
}

export interface AddressBook {
  row_id: number
  id: string
  username: string
  password?: string
  hostname: string
  alias?: string
  platform: string
  tags?: string[]
  user_id: number
  online?: boolean
  loginName?: string
  sameServer?: boolean
  created_at?: string
  updated_at?: string
}

export interface Tag {
  id: number
  name: string
  user_id: number
  color: number
  created_at?: string
  updated_at?: string
}
