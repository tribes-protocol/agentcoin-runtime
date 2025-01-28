import { isRequiredString } from '@/common/functions'
import { EthAddressSchema } from '@memecoin/sdk'
import { z } from 'zod'

export const AgentResponseSchema = z.object({
  user: z.string().optional(),
  text: z.string(),
  action: z.string().optional()
})

export const MessageSchema = z.object({
  id: z.number(),
  clientUuid: z.string(),
  channel: EthAddressSchema,
  sender: EthAddressSchema,
  balance: z.union([z.bigint(), z.string().transform((arg) => BigInt(arg))]),
  coinAddress: EthAddressSchema,
  text: z.string(),
  openGraphId: z.string().nullable(),
  createdAt: z.preprocess((arg) => (isRequiredString(arg) ? new Date(arg) : arg), z.date())
})

export const CreateMessageSchema = MessageSchema.omit({
  id: true,
  createdAt: true,
  coinAddress: true
})

export type CreateMessage = z.infer<typeof CreateMessageSchema>

export const UserSchema = z.object({
  id: z.number(),
  address: EthAddressSchema,
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
