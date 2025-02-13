import { AgentcoinClientInterface } from '@/clients/agentcoin'
import { SentinelClient } from '@/clients/sentinel'
import { AGENT_SENTINEL_DIR } from '@/common/constants'
import { FarcasterAgentClient } from '@elizaos/client-farcaster'
import { TelegramClientInterface } from '@elizaos/client-telegram'
import { TwitterClientInterface } from '@elizaos/client-twitter'
import { AgentRuntime, Character, Client, Clients } from '@elizaos/core'
import os from 'os'
import path from 'path'

export async function initializeClients(
  character: Character,
  runtime: AgentRuntime
): Promise<Client[]> {
  const clients = []
  const clientTypes = character.clients?.map((str) => str.toLowerCase()) || []

  if (clientTypes.includes(Clients.TELEGRAM)) {
    const telegramClient = await TelegramClientInterface.start(runtime)
    if (telegramClient) clients.push(telegramClient)
  }

  if (clientTypes.includes(Clients.TWITTER)) {
    const twitterClients = await TwitterClientInterface.start(runtime)
    clients.push(twitterClients)
  }

  if (clientTypes.includes(Clients.FARCASTER)) {
    const farcasterClient = new FarcasterAgentClient(runtime)
    if (farcasterClient) clients.push(farcasterClient)
  }

  // add the agentcoin client
  clients.push(await AgentcoinClientInterface.start(runtime))

  if (character.plugins?.length > 0) {
    for (const plugin of character.plugins) {
      if (plugin.clients) {
        for (const client of plugin.clients) {
          clients.push(await client.start(runtime))
        }
      }
    }
  }

  return clients
}

export const sentinelClient = new SentinelClient(
  path.join(os.homedir(), AGENT_SENTINEL_DIR, 'sentinel.sock')
)
