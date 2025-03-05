import { boolean, integer, jsonb, pgTable, text, timestamp, vector } from 'drizzle-orm/pg-core'
import { z } from 'zod'

// Create a Zod schema for RagKnowledgeItemContent
export const RagKnowledgeItemContentSchema = z.object({
  text: z.string(),
  metadata: z
    .object({
      isMain: z.boolean().optional().nullable(),
      isChunk: z.boolean().optional().nullable(),
      originalId: z.string().optional().nullable(),
      chunkIndex: z.number().optional().nullable(),
      source: z.string().optional().nullable(),
      type: z.string().optional().nullable(),
      isShared: z.boolean().optional().nullable()
    })
    .passthrough()
    .optional()
})

// Infer the type from the schema instead of defining it separately
export type RagKnowledgeItemContent = z.infer<typeof RagKnowledgeItemContentSchema>

// Forward declaration of Accounts to resolve circular reference
export const Accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  name: text('name'),
  username: text('username'),
  email: text('email').notNull(),
  avatarUrl: text('avatarUrl'),
  details: jsonb('details').default({})
})

// Define Knowledges table with references
export const Knowledges = pgTable('knowledge', {
  id: text('id').primaryKey(),
  agentId: text('agentId').references(() => Accounts.id),
  content: jsonb('content').$type<RagKnowledgeItemContent>().notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  isMain: boolean('isMain').default(false),
  originalId: text('originalId'),
  chunkIndex: integer('chunkIndex'),
  isShared: boolean('isShared').default(false)
})

export type Knowledge = typeof Knowledges.$inferSelect
