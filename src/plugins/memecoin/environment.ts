import { IAgentRuntime } from '@elizaos/core'
import { z } from 'zod'

export const memecoinEnvSchema = z.object({
  BOT_PRIVATE_KEY: z
    .string()
    .min(1, 'Memecoin bot private key is required')
    .refine((key) => /^0x[a-fA-F0-9]{64}$/.test(key), {
      message:
        "Memecoin bot private key must be a 64-character hexadecimal string (32 bytes) with '0x' prefix"
    }),
  BASE_RPC_URL: z.string().min(1, 'Base RPC URL is required')
})

export type MemecoinConfig = z.infer<typeof memecoinEnvSchema>

export async function validateMemecoinConfig(runtime: IAgentRuntime): Promise<MemecoinConfig> {
  try {
    const config = {
      BOT_PRIVATE_KEY: runtime.getSetting('BOT_PRIVATE_KEY') || process.env.BOT_PRIVATE_KEY,
      BASE_RPC_URL: runtime.getSetting('BASE_RPC_URL') || process.env.BASE_RPC_URL
    }

    return memecoinEnvSchema.parse(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n')
      throw new Error(`Memecoin configuration validation failed:\n${errorMessages}`)
    }
    throw error
  }
}
