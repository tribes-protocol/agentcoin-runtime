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
import { IAgentcoinService, IWalletService } from '@/services/interfaces'
import { KeychainService } from '@/services/keychain'
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
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function createAgent(
  character: Character,
  db: IDatabaseAdapter,
  cache: ICacheManager,
  token: string,
  agentcoinService: IAgentcoinService,
  walletService: IWalletService
): AgentcoinRuntime {
  elizaLogger.info(elizaLogger.successesTitle, 'Creating runtime for character', character.name)

  const nodePlugin = createNodePlugin()

  return new AgentcoinRuntime({
    agentcoin: {
      agent: agentcoinService,
      wallet: walletService
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
  // step 1: provision the hardware if needed.
  const keychainService = new KeychainService()
  const agentcoinAPI = new AgentcoinAPI()
  const agentcoinService = new AgentcoinService(keychainService, agentcoinAPI)
  await agentcoinService.provisionIfNeeded()

  const agentcoinCookie = await agentcoinService.getCookie()
  const eventService = new EventService(agentcoinCookie, agentcoinAPI)
  const walletService = new WalletService(keychainService.turnkeyApiKeyStamper)
  const configService = new ConfigService(eventService)

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

    runtime = createAgent(character, db, cache, token, agentcoinService, walletService)

    let isShuttingDown = false
    const shutdown = async (signal: string): Promise<void> => {
      if (isShuttingDown) {
        return
      }
      isShuttingDown = true
      elizaLogger.warn(`\nReceived ${signal} signal. Stopping agent...`)
      await Promise.all([configService.stop(), eventService.stop()])
      if (runtime) {
        try {
          const agentId = runtime.agentId
          await runtime.stop()
          elizaLogger.success('Agent stopped successfully!', agentId)
        } catch (error) {
          elizaLogger.error('Error stopping agent:', error)
        }
      }
      process.exit(0)
    }

    process.once('SIGINT', () => {
      void shutdown('SIGINT')
    })
    process.once('SIGTERM', () => {
      void shutdown('SIGTERM')
    })

    await runtime.initialize()
    runtime.clients = await initializeClients(character, runtime)
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`, error)
    throw error
  }

  elizaLogger.success('agent runtime started id:', runtime.agentId, 'name', runtime.character.name)
}

main().catch(elizaLogger.error)
