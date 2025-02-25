import { validateTelegramConfig } from '@/clients/client-telegram/environment'
import { TelegramClient } from '@/clients/client-telegram/telegramClient'
import type { Client, IAgentRuntime } from '@elizaos/core'
import { elizaLogger } from '@elizaos/core'

export const TelegramClientInterface: Client = {
  start: async (runtime: IAgentRuntime) => {
    await validateTelegramConfig(runtime)

    const tg = new TelegramClient(runtime, runtime.getSetting('TELEGRAM_BOT_TOKEN'))

    await tg.start()

    elizaLogger.success(
      `✅ Telegram client successfully started for character ${runtime.character.name}`
    )
    return tg
  },
  stop: async (_runtime: IAgentRuntime) => {
    elizaLogger.warn('Telegram client does not support stopping yet')
  }
}

export default TelegramClientInterface
