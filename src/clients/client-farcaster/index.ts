import { FarcasterClient } from '@/clients/client-farcaster/client'
import {
  validateFarcasterConfig,
  type FarcasterConfig
} from '@/clients/client-farcaster/environment'
import { FarcasterInteractionManager } from '@/clients/client-farcaster/interactions'
import { FarcasterPostManager } from '@/clients/client-farcaster/post'
import { elizaLogger, type Client, type IAgentRuntime } from '@elizaos/core'
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk'

/**
 * A manager that orchestrates all Farcaster operations:
 * - client: base operations (Neynar client, hub connection, etc.)
 * - posts: autonomous posting logic
 * - interactions: handling mentions, replies, likes, etc.
 */
class FarcasterManager {
  client: FarcasterClient
  posts: FarcasterPostManager
  interactions: FarcasterInteractionManager
  private signerUuid: string

  constructor(runtime: IAgentRuntime, farcasterConfig: FarcasterConfig) {
    const cache = new Map<string, unknown>()
    this.signerUuid = runtime.getSetting('FARCASTER_NEYNAR_SIGNER_UUID')

    const neynarConfig = new Configuration({
      apiKey: runtime.getSetting('FARCASTER_NEYNAR_API_KEY')
    })

    const neynarClient = new NeynarAPIClient(neynarConfig)

    this.client = new FarcasterClient({
      runtime,
      ssl: true,
      url: runtime.getSetting('FARCASTER_HUB_URL') ?? 'hub.pinata.cloud',
      neynar: neynarClient,
      signerUuid: this.signerUuid,
      cache,
      farcasterConfig
    })

    elizaLogger.success('Farcaster Neynar client initialized.')

    this.posts = new FarcasterPostManager(this.client, runtime, this.signerUuid, cache)

    this.interactions = new FarcasterInteractionManager(
      this.client,
      runtime,
      this.signerUuid,
      cache
    )
  }

  async start(): Promise<void> {
    await Promise.all([this.posts.start(), this.interactions.start()])
  }

  async stop(): Promise<void> {
    await Promise.all([this.posts.stop(), this.interactions.stop()])
  }
}

export const FarcasterClientInterface: Client = {
  async start(runtime: IAgentRuntime) {
    const farcasterConfig = await validateFarcasterConfig(runtime)

    elizaLogger.log('Farcaster client started')

    const manager = new FarcasterManager(runtime, farcasterConfig)

    // Start all services
    await manager.start()
    runtime.clients.farcaster = manager
    return manager
  },

  async stop(runtime: IAgentRuntime) {
    try {
      // stop it
      elizaLogger.log('Stopping farcaster client', runtime.agentId)
      if (runtime.clients.farcaster) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        await (runtime.clients.farcaster as FarcasterManager).stop()
      }
    } catch (e) {
      elizaLogger.error('client-farcaster interface stop error', e)
    }
  }
}

export default FarcasterClientInterface
