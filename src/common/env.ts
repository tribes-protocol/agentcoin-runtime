import { ensureString, prepend0x } from '@/common/functions'

export const AGENTCOIN_FUN_API_URL = ensureString(
  process.env.AGENTCOIN_FUN_API_URL,
  'AGENTCOIN_FUN_API_URL is not set'
)

export const AGENTCOIN_CHANNEL = ensureString(
  process.env.AGENTCOIN_CHANNEL,
  'AGENTCOIN_CHANNEL is not set'
)

export const CHARACTER_FILE = ensureString(process.env.CHARACTER_FILE, 'CHARACTER_FILE is not set')

export const SQLITE_FILE = ensureString(process.env.SQLITE_FILE, 'SQLITE_FILE is not set')

export const BOT_PRIVATE_KEY = prepend0x(
  ensureString(process.env.BOT_PRIVATE_KEY, 'BOT_PRIVATE_KEY is not set')
)
