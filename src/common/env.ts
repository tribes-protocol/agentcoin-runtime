import { ensureString } from '@/common/functions'

export const AGENTCOIN_FUN_API_URL = ensureString(
  process.env.AGENTCOIN_FUN_API_URL,
  'AGENTCOIN_FUN_API_URL is not set'
)

export const BASE_RPC_URL = ensureString(process.env.BASE_RPC_URL, 'BASE_RPC_URL is not set')

export const POSTGRES_URL = ensureString(process.env.POSTGRES_URL, 'POSTGRES_URL is not set')

export const AGENT_ADMIN_PUBLIC_KEY =
  process.env.AGENT_ADMIN_PUBLIC_KEY ||
  '02ef90c742e3a447ceec17330d4eccedf8b604487b0cda150c3e1babcbd4076967'
