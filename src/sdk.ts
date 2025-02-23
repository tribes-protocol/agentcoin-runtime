import { AgentcoinAPI } from '@/apis/agentcoinfun'
import { initializeClients } from '@/clients'
import { getTokenForProvider } from '@/common/config'
import { CHARACTER_FILE } from '@/common/constants'
import { initializeDatabase } from '@/common/db'
import { AgentcoinRuntime } from '@/common/runtime'
import {
  Context,
  ContextHandler,
  NewMessageEvent,
  NewMessageHandler,
  SdkEventKind
} from '@/common/types'
import agentcoinPlugin from '@/plugins/agentcoin'
import { AgentcoinService } from '@/services/agentcoinfun'
import { ConfigService } from '@/services/config'
import { EventService } from '@/services/event'
import { KeychainService } from '@/services/keychain'
import { KnowledgeService } from '@/services/knowledge'
import { ProcessService } from '@/services/process'
import { WalletService } from '@/services/wallet'
import { CacheManager, DbCacheAdapter, elizaLogger, UUID, type Character } from '@elizaos/core'
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap'
import { createNodePlugin } from '@elizaos/plugin-node'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)

export interface IAgentcoinSDK {
  readonly agentId: UUID
  on(event: 'message', handler: NewMessageHandler): void
  on(event: 'prellm', handler: ContextHandler): void
  on(event: 'postllm', handler: ContextHandler): void
  on(event: 'preaction', handler: ContextHandler): void
  on(event: 'postaction', handler: ContextHandler): void
}

export class AgentcoinSDK implements IAgentcoinSDK {
  private messageHandlers: NewMessageHandler[] = []
  private preLLMHandlers: ContextHandler[] = []
  private postLLMHandlers: ContextHandler[] = []
  private preActionHandlers: ContextHandler[] = []
  private postActionHandlers: ContextHandler[] = []
  private readonly runtime: AgentcoinRuntime

  get agentId(): UUID {
    return this.runtime.agentId
  }

  private constructor(runtime: AgentcoinRuntime) {
    this.runtime = runtime
  }

  static async start(): Promise<IAgentcoinSDK> {
    elizaLogger.info('Starting agent...')

    // step 1: provision the hardware if needed.
    const keychainService = new KeychainService()
    const agentcoinAPI = new AgentcoinAPI()
    const agentcoinService = new AgentcoinService(keychainService, agentcoinAPI)
    await agentcoinService.provisionIfNeeded()

    const agentcoinCookie = await agentcoinService.getCookie()
    const eventService = new EventService(agentcoinCookie, agentcoinAPI)
    const walletService = new WalletService(keychainService.turnkeyApiKeyStamper)
    const processService = new ProcessService()
    const configService = new ConfigService(eventService, processService)

    void Promise.all([eventService.start(), configService.start()])

    // step 2: load character
    elizaLogger.info('Loading character...')
    const character: Character = JSON.parse(fs.readFileSync(CHARACTER_FILE, 'utf8'))

    // step 3: initialize eliza runtime
    let runtime: AgentcoinRuntime | undefined

    try {
      const token = getTokenForProvider(character.modelProvider, character)
      const db = await initializeDatabase()
      const cache = new CacheManager(new DbCacheAdapter(db, character.id))

      elizaLogger.info(elizaLogger.successesTitle, 'Creating runtime for character', character.name)
      runtime = new AgentcoinRuntime({
        agentcoin: {
          agent: agentcoinService,
          wallet: walletService,
          config: configService
        },
        eliza: {
          databaseAdapter: db,
          token,
          modelProvider: character.modelProvider,
          evaluators: [],
          character,
          plugins: [bootstrapPlugin, createNodePlugin(), agentcoinPlugin],
          providers: [],
          actions: [],
          services: [],
          managers: [],
          cacheManager: cache
        }
      })

      const knowledgeService = new KnowledgeService(runtime)

      // shutdown handler
      let isShuttingDown = false
      const shutdown = async (signal?: string): Promise<void> => {
        try {
          if (isShuttingDown) {
            return
          }
          isShuttingDown = true

          elizaLogger.warn(`Received ${signal} signal. Stopping agent...`)
          await Promise.all([configService.stop(), eventService.stop(), knowledgeService.stop()])
          elizaLogger.success('Agent stopped services successfully!')

          if (runtime) {
            try {
              const agentId = runtime.agentId
              elizaLogger.warn('Stopping agent runtime...', agentId)
              await runtime.stop()
              elizaLogger.success('Agent runtime stopped successfully!', agentId)
            } catch (error) {
              elizaLogger.error('Error stopping agent:', error)
            }
          }

          console.log('The End.')
          elizaLogger.success('The End.')
          process.exit(0)
        } catch (error) {
          elizaLogger.error('Error shutting down:', error)
          console.log('The End.')
          elizaLogger.success('The End.')
          process.exit(1)
        }
      }

      processService.setShutdownFunc(shutdown)

      process.once('SIGINT', () => {
        void shutdown('SIGINT')
      })
      process.once('SIGTERM', () => {
        void shutdown('SIGTERM')
      })

      await runtime.initialize()
      runtime.clients = await initializeClients(character, runtime)
      elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`)

      void knowledgeService.start()
    } catch (error) {
      elizaLogger.error(`Error starting agent for character ${character.name}:`, error)
      throw error
    }

    elizaLogger.success(
      'agent runtime started id:',
      runtime.agentId,
      'name',
      runtime.character.name
    )

    const sdk = new AgentcoinSDK(runtime)
    await runtime.configure({
      eventHandler: (event, params) => sdk.handle(event, params)
    })
    return sdk
  }

  on(event: 'message', handler: NewMessageHandler): void
  on(event: 'prellm', handler: ContextHandler): void
  on(event: 'postllm', handler: ContextHandler): void
  on(event: 'preaction', handler: ContextHandler): void
  on(event: 'postaction', handler: ContextHandler): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: any): void {
    switch (event) {
      case 'message':
        this.messageHandlers.push(handler)
        break
      case 'prellm':
        this.preLLMHandlers.push(handler)
        break
      case 'postllm':
        this.postLLMHandlers.push(handler)
        break
      case 'preaction':
        this.preActionHandlers.push(handler)
        break
      case 'postaction':
        this.postActionHandlers.push(handler)
        break
      default:
        throw new Error(`Unknown event: ${event}`)
    }
  }

  off(event: 'message', handler: NewMessageHandler): void
  off(event: 'prellm', handler: ContextHandler): void
  off(event: 'postllm', handler: ContextHandler): void
  off(event: 'preaction', handler: ContextHandler): void
  off(event: 'postaction', handler: ContextHandler): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, handler: any): void {
    switch (event) {
      case 'message':
        this.messageHandlers = this.messageHandlers.filter((h) => h !== handler)
        break
      case 'prellm':
        this.preLLMHandlers = this.preLLMHandlers.filter((h) => h !== handler)
        break
      case 'postllm':
        this.postLLMHandlers = this.postLLMHandlers.filter((h) => h !== handler)
        break
      case 'preaction':
        this.preActionHandlers = this.preActionHandlers.filter((h) => h !== handler)
        break
      case 'postaction':
        this.postActionHandlers = this.postActionHandlers.filter((h) => h !== handler)
        break
      default:
        throw new Error(`Unknown event: ${event}`)
    }
  }

  protected async handle(event: SdkEventKind, params: Context | NewMessageEvent): Promise<boolean> {
    switch (event) {
      case 'message': {
        for (const handler of this.messageHandlers) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const result = await handler(params as NewMessageEvent)
          if (!result) return false
        }
        break
      }

      case 'prellm': {
        for (const handler of this.preLLMHandlers) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const shouldContinue = await handler(params as Context)
          if (!shouldContinue) return false
        }
        break
      }

      case 'postllm': {
        for (const handler of this.postLLMHandlers) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const shouldContinue = await handler(params as Context)
          if (!shouldContinue) return false
        }
        break
      }

      case 'preaction': {
        for (const handler of this.preActionHandlers) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const shouldContinue = await handler(params as Context)
          if (!shouldContinue) return false
        }
        break
      }

      case 'postaction': {
        for (const handler of this.postActionHandlers) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const shouldContinue = await handler(params as Context)
          if (!shouldContinue) return false
        }
        break
      }
    }

    return true
  }
}
