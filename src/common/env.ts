import { ensureString } from "@/functions"
import { EthAddressSchema } from "@memecoin/sdk"

export const AGENTCOIN_FUN_API_URL = ensureString(
  process.env.AGENTCOIN_FUN_API_URL,
  "AGENTCOIN_FUN_API_URL is not set"
)

export const AGENTCOIN_CHANNEL = EthAddressSchema.parse(
  ensureString(process.env.AGENTCOIN_CHANNEL, "AGENTCOIN_CHANNEL is not set")
)

export const AGENTCOIN_SENDER = EthAddressSchema.parse(
  "0xf4d70d2fd1de59ff34aa0350263ba742cb94b1c8"
)

export const CHARACTER_FILE = ensureString(
  process.env.CHARACTER_FILE,
  "CHARACTER_FILE is not set"
)

export const CODE_REPOSITORY = ensureString(
  process.env.CODE_REPOSITORY,
  "CODE_REPOSITORY is not set"
)

export const SQLITE_FILE = ensureString(
  process.env.SQLITE_FILE,
  "SQLITE_FILE is not set"
)

export const BOT_PRIVATE_KEY = ensureString(
  process.env.BOT_PRIVATE_KEY,
  "BOT_PRIVATE_KEY is not set"
)
