import { Tweet } from 'agent-twitter-client'
import { z } from 'zod'

export type MediaData = {
  data: Buffer
  mediaType: string
}

export interface SpaceConfig {
  mode: 'BROADCAST' | 'LISTEN' | 'INTERACTIVE'
  title?: string
  description?: string
  languages?: string[]
}

// Define Zod schema for Twitter API response
const TweetLegacySchema = z.object({
  full_text: z.string(),
  conversation_id_str: z.string(),
  created_at: z.string(),
  user_id_str: z.string(),
  in_reply_to_status_id_str: z.string().nullable().optional(),
  bookmark_count: z.number().optional(),
  is_quote_status: z.boolean().optional(),
  retweeted: z.boolean().optional(),
  favorite_count: z.number().optional(),
  quote_count: z.number().optional(),
  reply_count: z.number().optional(),
  retweet_count: z.number().optional(),
  retweeted_status_id_str: z.string().optional(),
  quoted_status_id_str: z.string().optional(),
  lang: z.string().optional(),
  entities: z
    .object({
      hashtags: z.array(z.any()).optional(),
      user_mentions: z.array(z.any()).optional(),
      urls: z.array(z.any()).optional(),
      media: z
        .array(
          z.object({
            id_str: z.string(),
            media_url_https: z.string(),
            type: z.string(),
            alt_text: z.string().optional()
          })
        )
        .optional()
    })
    .optional()
})

const UserResultSchema = z.object({
  legacy: z
    .object({
      name: z.string().optional(),
      screen_name: z.string().optional()
    })
    .optional()
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CoreSchema = z.object({
  user_results: z
    .object({
      result: UserResultSchema.optional()
    })
    .optional()
})

// Define the schema for raw tweet data
export interface RawTweetType {
  id?: string
  id_str?: string
  rest_id?: string
  text?: string
  html?: string
  bookmarkCount?: number
  conversationId?: string
  hashtags?: unknown[]
  inReplyToStatus?: Tweet
  inReplyToStatusId?: string
  isPin?: boolean
  isReply?: boolean
  isSelfThread?: boolean
  mentions?: unknown[]
  name?: string
  permanentUrl?: string
  photos?: { id: string; url: string; alt_text: string }[]
  place?: unknown
  poll?: {
    options: {
      label: string
      position: number
      votes: number
    }[]
    id: string
  }
  quotedStatusId?: string
  thread?: Tweet[]
  timestamp?: number
  timeParsed?: Date
  urls?: unknown[]
  userId?: string
  username?: string
  videos?: { id: string; preview: string }[]
  views?: { count?: string | number }
  sensitiveContent?: boolean
  legacy?: z.infer<typeof TweetLegacySchema>
  core?: z.infer<typeof CoreSchema>
  quoted_status_result?: {
    result?: RawTweetType
  }
  retweeted_status_result?: {
    result?: RawTweetType
  }
  user_results?: {
    result?: z.infer<typeof UserResultSchema>
  }
}

// export const RawTweetSchema: z.ZodType<RawTweetType> = z.lazy(() =>
//   z.object({
//     id: z.string().optional(),
//     id_str: z.string().optional(),
//     rest_id: z.string().optional(),
//     text: z.string().optional(),
//     html: z.string().optional(),
//     bookmarkCount: z.number().optional(),
//     conversationId: z.string().optional(),
//     hashtags: z.array(z.unknown()).optional(),
//     inReplyToStatus: z.unknown().optional(),
//     inReplyToStatusId: z.string().optional(),
//     isPin: z.boolean().optional(),
//     isReply: z.boolean().optional(),
//     isSelfThread: z.boolean().optional(),
//     mentions: z.array(z.unknown()).optional(),
//     name: z.string().optional(),
//     permanentUrl: z.string().optional(),
//     photos: z.array(z.unknown()).optional(),
//     place: z.unknown().optional(),
//     poll: z.unknown().optional(),
//     quotedStatusId: z.string().optional(),
//     thread: z.array(z.unknown()).optional(),
//     timestamp: z.number().optional(),
//     timeParsed: z.date().optional(),
//     urls: z.array(z.unknown()).optional(),
//     userId: z.string().optional(),
//     username: z.string().optional(),
//     videos: z.array(z.unknown()).optional(),
//     views: z.object({ count: z.string().or(z.number()).optional() }).optional(),
//     sensitiveContent: z.boolean().optional(),
//     legacy: TweetLegacySchema.optional(),
//     core: CoreSchema.optional(),
//     quoted_status_result: z
//       .object({
//         result: z.lazy(() => RawTweetSchema).optional()
//       })
//       .optional(),
//     retweeted_status_result: z
//       .object({
//         result: z.lazy(() => RawTweetSchema).optional()
//       })
//       .optional(),
//     user_results: z
//       .object({
//         result: UserResultSchema.optional()
//       })
//       .optional()
//   })
// )

// export type RawTweet = z.infer<typeof RawTweetSchema>

const TweetResultSchema = z.object({
  rest_id: z.string(),
  legacy: TweetLegacySchema
})

const TweetResultsSchema = z.object({
  result: TweetResultSchema
})

export const CreateTweetResponseSchema = z.object({
  data: z
    .object({
      create_tweet: z
        .object({
          tweet_results: TweetResultsSchema
        })
        .nullable()
        .optional(),
      notetweet_create: z
        .object({
          tweet_results: TweetResultsSchema
        })
        .nullable()
        .optional()
    })
    .nullable()
    .optional()
})

export interface TwitterCookie {
  key: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite?: 'Lax' | 'Strict' | 'None' | string
}
