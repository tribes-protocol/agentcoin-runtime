import { isRequiredString, sortIdentities } from '@/common/functions'
import { isAddress } from 'viem'
import { z } from 'zod'

export const ErrorResponseSchema = z.object({
  error: z.string()
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export const HexStringSchema = z.custom<`0x${string}`>(
  (val): val is `0x${string}` => typeof val === 'string' && /^0x[a-fA-F0-9]+$/.test(val)
)

export type HexString = z.infer<typeof HexStringSchema>

export const EthAddressSchema = z
  .custom<`0x${string}`>((val): val is `0x${string}` => typeof val === 'string' && isAddress(val))
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  .transform((arg) => arg.toLowerCase() as `0x${string}`)

export type EthAddress = z.infer<typeof EthAddressSchema>

export const SolAddressSchema = z.string().refine(
  (val) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val)
  },
  {
    message: 'Invalid Solana address format'
  }
)

export type SolAddress = z.infer<typeof SolAddressSchema>

export const WalletAddressSchema = z.union([EthAddressSchema, SolAddressSchema])

export type WalletAddress = z.infer<typeof WalletAddressSchema>

export const AgentIdentitySchema = z.object({
  id: z.number()
})

export type AgentIdentity = z.infer<typeof AgentIdentitySchema>

export const IdentitySchema = z.union([EthAddressSchema, AgentIdentitySchema])

export type Identity = z.infer<typeof IdentitySchema>

export const AgentResponseSchema = z.object({
  user: z.string().optional(),
  text: z.string(),
  action: z.string().optional()
})

export const BigintSchema = z.union([z.bigint(), z.string().transform((arg) => BigInt(arg))])

export const AgentMessageMetadataSchema = z.object({
  balance: z.coerce.bigint().nullable(),
  coinAddress: EthAddressSchema.nullable()
})

export type AgentMessageMetadata = z.infer<typeof AgentMessageMetadataSchema>

export enum ChatChannelKind {
  COIN = 'coin',
  DM = 'dm'
}
export const ChatChannelKindSchema = z.nativeEnum(ChatChannelKind)

export const CoinChannelSchema = z.object({
  kind: z.literal(ChatChannelKind.COIN),
  chainId: z.coerce.number().int().positive(),
  address: EthAddressSchema
})

export const DMChannelSchema = z
  .object({
    kind: z.literal(ChatChannelKind.DM),
    firstIdentity: IdentitySchema,
    secondIdentity: IdentitySchema
  })
  .transform((data) => {
    const [first, second] = sortIdentities(data.firstIdentity, data.secondIdentity)
    return {
      ...data,
      firstIdentity: first,
      secondIdentity: second
    }
  })

export const ChatChannelSchema = z.union([CoinChannelSchema, DMChannelSchema])

export type CoinChannel = z.infer<typeof CoinChannelSchema>
export type DMChannel = z.infer<typeof DMChannelSchema>
export type ChatChannel = z.infer<typeof ChatChannelSchema>

// User schema

export const UserSchema = z.object({
  id: z.number(),
  identity: IdentitySchema,
  username: z.string(),
  bio: z.string().nullable().optional(),
  image: z.string().nullable().optional()
})

export type User = z.infer<typeof UserSchema>

// Messaging schema

export const MessageSchema = z.object({
  id: z.number(),
  clientUuid: z.string(),
  channel: ChatChannelSchema,
  sender: IdentitySchema,
  text: z.string(),
  openGraphId: z.string().nullable(),
  metadata: AgentMessageMetadataSchema,
  createdAt: z.preprocess((arg) => (isRequiredString(arg) ? new Date(arg) : arg), z.date())
})

export const CreateMessageSchema = MessageSchema.omit({
  id: true,
  createdAt: true,
  metadata: true
})

export type CreateMessage = z.infer<typeof CreateMessageSchema>

export const OG_KINDS = ['website', 'image', 'video', 'tweet', 'launch'] as const

export const OpenGraphSchema = z.object({
  id: z.string(),
  url: z.string(),
  kind: z.enum(OG_KINDS).default('website'),
  data: z.string(),
  createdAt: z.preprocess((arg) => (isRequiredString(arg) ? new Date(arg) : arg), z.date())
})

export const HydratedMessageSchema = z.object({
  message: MessageSchema,
  // user: UserSchema, // FIXME: enable once fixed
  openGraph: OpenGraphSchema.optional().nullable()
})

export type HydratedMessage = z.infer<typeof HydratedMessageSchema>

export const AgentWalletKindSchema = z.enum(['evm', 'solana'])

export type AgentWalletKind = z.infer<typeof AgentWalletKindSchema>

export const AgentWalletSchema = z.object({
  id: z.number(),
  address: WalletAddressSchema,
  kind: AgentWalletKindSchema,
  label: z.string(),
  subOrganizationId: z.string(),
  agentId: z.number().nullable(),
  isDefault: z.boolean().default(false),
  isRevoked: z.boolean().default(false),
  agentUserId: z.string(),
  createdAt: z.preprocess((arg) => (isRequiredString(arg) ? new Date(arg) : arg), z.date())
})

export type AgentWallet = z.infer<typeof AgentWalletSchema>
