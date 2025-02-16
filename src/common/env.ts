import { ensureString } from '@/common/functions'
import { EthAddressSchema } from '@/common/types'

export const AGENTCOIN_FUN_API_URL = ensureString(
  process.env.AGENTCOIN_FUN_API_URL,
  'AGENTCOIN_FUN_API_URL is not set'
)

export const AGENTCOIN_CHANNEL = ensureString(
  process.env.AGENTCOIN_CHANNEL,
  'AGENTCOIN_CHANNEL is not set'
)

export const TOKEN_ADDRESS = EthAddressSchema.parse(
  ensureString(process.env.TOKEN_ADDRESS, 'TOKEN_ADDRESS is not set')
)

export const BASE_RPC_URL = ensureString(process.env.BASE_RPC_URL, 'BASE_RPC_URL is not set')
