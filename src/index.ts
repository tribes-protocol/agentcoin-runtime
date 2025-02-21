import { AgentcoinAPI } from '@/apis/agentcoinfun'
import { initializeClients } from '@/clients'
import { getTokenForProvider } from '@/common/config'
import { CHARACTER_FILE } from '@/common/constants'
import { initializeDatabase } from '@/common/db'
import { AgentcoinRuntime } from '@/common/runtime'
import agentcoinPlugin from '@/plugins/agentcoin'
import { AgentcoinService } from '@/services/agentcoinfun'
import { ConfigService } from '@/services/config'
import { EventService } from '@/services/event'
import { IAgentcoinService, IConfigService, IWalletService } from '@/services/interfaces'
import { KeychainService } from '@/services/keychain'
import { KnowledgeService } from '@/services/knowledge'
import { ProcessService } from '@/services/process'
import { WalletService } from '@/services/wallet'
import {
  CacheManager,
  DbCacheAdapter,
  elizaLogger,
  ICacheManager,
  IDatabaseAdapter,
  type Character
} from '@elizaos/core'
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap'
import { createNodePlugin } from '@elizaos/plugin-node'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)

export function createAgent(
  character: Character,
  db: IDatabaseAdapter,
  cache: ICacheManager,
  token: string,
  agentcoinService: IAgentcoinService,
  walletService: IWalletService,
  configService: IConfigService
): AgentcoinRuntime {
  elizaLogger.info(elizaLogger.successesTitle, 'Creating runtime for character', character.name)

  const nodePlugin = createNodePlugin()

  return new AgentcoinRuntime({
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
      plugins: [bootstrapPlugin, nodePlugin, agentcoinPlugin],
      providers: [],
      actions: [],
      services: [],
      managers: [],
      cacheManager: cache
    }
  })
}

async function main(): Promise<void> {
  console.log('Starting agent...')
  // step 1: provision the hardware if needed.
  const keychainService = new KeychainService()
  console.log('Created keychain service')
  const agentcoinAPI = new AgentcoinAPI()
  console.log('Created agentcoin API')
  const agentcoinService = new AgentcoinService(keychainService, agentcoinAPI)
  console.log('Created agentcoin service')
  await agentcoinService.provisionIfNeeded()
  console.log('Provisioned if needed')

  const agentcoinCookie = await agentcoinService.getCookie()
  console.log('Got agentcoin cookie')
  const eventService = new EventService(agentcoinCookie, agentcoinAPI)
  console.log('Created event service')
  const walletService = new WalletService(keychainService.turnkeyApiKeyStamper)
  console.log('Created wallet service')
  const processService = new ProcessService()
  console.log('Created process service')
  const configService = new ConfigService(eventService, processService)
  console.log('Created config service')

  void Promise.all([eventService.start(), configService.start()])
  console.log('Started event and config services')

  // step 2: load character
  elizaLogger.info('Loading character...')
  const character: Character = JSON.parse(fs.readFileSync(CHARACTER_FILE, 'utf8'))

  // step 3: initialize eliza runtime
  let runtime: AgentcoinRuntime | undefined

  try {
    const token = getTokenForProvider(character.modelProvider, character)
    const db = await initializeDatabase()
    const cache = new CacheManager(new DbCacheAdapter(db, character.id))

    runtime = createAgent(
      character,
      db,
      cache,
      token,
      agentcoinService,
      walletService,
      configService
    )

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

    await knowledgeService.start()
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`, error)
    throw error
  }

  elizaLogger.success('agent runtime started id:', runtime.agentId, 'name', runtime.character.name)
}

console.log('hello, agent!')
main().catch(elizaLogger.error)
