import { isRequiredString } from '@/common/functions'
import { isAddress } from 'viem'
import { z } from 'zod'

export const HexStringSchema = z.custom<`0x${string}`>(
  (val): val is `0x${string}` => typeof val === 'string' && /^0x[a-fA-F0-9]+$/.test(val)
)

export type HexString = z.infer<typeof HexStringSchema>

export const EthAddressSchema = z
  .custom<`0x${string}`>((val): val is `0x${string}` => typeof val === 'string' && isAddress(val))
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  .transform((arg) => arg.toLowerCase() as `0x${string}`)

export type EthAddress = z.infer<typeof EthAddressSchema>

export const AgentIdentitySchema = z
  .string()
  .regex(/^agent:\d+$/, 'Must be in format agent:{numericId}')
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  .transform((val) => val.toLowerCase() as `agent:${number}`)

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
  balance: z.coerce.bigint(),
  coinAddress: EthAddressSchema
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
    firstAddress: EthAddressSchema,
    secondAddress: EthAddressSchema
  })
  .refine((data) => BigInt(data.firstAddress) < BigInt(data.secondAddress), {
    message: 'First address must be less than second address'
  })

export const ChatChannelSchema = z.union([CoinChannelSchema, DMChannelSchema])

export type CoinChannel = z.infer<typeof CoinChannelSchema>
export type DMChannel = z.infer<typeof DMChannelSchema>
export type ChatChannel = z.infer<typeof ChatChannelSchema>

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

export const UserSchema = z.object({
  id: z.number(),
  identity: IdentitySchema,
  username: z.string(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
  createdAt: z.preprocess((arg) => (isRequiredString(arg) ? new Date(arg) : arg), z.date())
})

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
