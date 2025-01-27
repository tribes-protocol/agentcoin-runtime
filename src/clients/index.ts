import { AgentcoinClientInterface } from '@/clients/agentcoin'
import { AutoClientInterface } from '@elizaos/client-auto'
import DirectClientInterface, { DirectClient } from '@elizaos/client-direct'
import { DiscordClientInterface } from '@elizaos/client-discord'
import { TelegramClientInterface } from '@elizaos/client-telegram'
import { TwitterClientInterface } from '@elizaos/client-twitter'
import { AgentRuntime, Character, Client, Clients } from '@elizaos/core'

export async function initializeClients(
  character: Character,
  runtime: AgentRuntime
): Promise<Client[]> {
  const clients = []
  const clientTypes = character.clients?.map((str) => str.toLowerCase()) || []

  if (clientTypes.includes(Clients.AUTO)) {
    const autoClient = await AutoClientInterface.start(runtime)
    if (autoClient) clients.push(autoClient)
  }

  if (clientTypes.includes(Clients.DISCORD)) {
    clients.push(await DiscordClientInterface.start(runtime))
  }

  if (clientTypes.includes(Clients.TELEGRAM)) {
    const telegramClient = await TelegramClientInterface.start(runtime)
    if (telegramClient) clients.push(telegramClient)
  }

  if (clientTypes.includes(Clients.TWITTER)) {
    const twitterClients = await TwitterClientInterface.start(runtime)
    clients.push(twitterClients)
  }

  if (clientTypes.includes(Clients.DIRECT)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const directClient = (await DirectClientInterface.start(runtime)) as DirectClient
    directClient.registerAgent(runtime)
    if (directClient) clients.push(directClient)
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
