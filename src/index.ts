import { AgentcoinAPI } from '@/apis/agentcoinfun'
import { initializeClients } from '@/clients'
import { getTokenForProvider } from '@/common/config'
import { initializeDatabase } from '@/common/db'
import { AgentcoinRuntime } from '@/common/runtime'
import tippingPlugin from '@/plugins/tipping'
import { AgentcoinService } from '@/services/agentcoinfun'
import { CodeService } from '@/services/code'
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
  elizaLogger.success(elizaLogger.successesTitle, 'Creating runtime for character', character.name)

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
      plugins: [bootstrapPlugin, nodePlugin, tippingPlugin],
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
  elizaLogger.log('Provisioning hardware...')
  const keychainService = new KeychainService()
  const agentcoinAPI = new AgentcoinAPI()
  const agentcoinService = new AgentcoinService(keychainService, agentcoinAPI)
  const walletService = new WalletService(keychainService.turnkeyApiKeyStamper)
  const codeService = new CodeService()
  await agentcoinService.provisionIfNeeded()
  await codeService.start()

  // step 2: load character
  elizaLogger.log('Loading character...')
  const characterFile = process.env.CHARACTER_FILE
  const character: Character = JSON.parse(fs.readFileSync(characterFile, 'utf8'))

  // step 3: initialize eliza runtime
  let runtime: AgentcoinRuntime | undefined

  try {
    const token = getTokenForProvider(character.modelProvider, character)
    const db = initializeDatabase()

    await db.init()

    const cache = new CacheManager(new DbCacheAdapter(db, character.id))

    runtime = createAgent(character, db, cache, token, agentcoinService, walletService)

    const shutdown = async (signal: string): Promise<void> => {
      elizaLogger.log(`\nReceived ${signal} signal. Stopping agent...`)
      await codeService.stop()
      if (runtime) {
        try {
          await runtime.stop()
          elizaLogger.success('Agent stopped successfully')
        } catch (error) {
          elizaLogger.error('Error stopping agent:', error)
        }
      }
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

    await runtime.initialize()
    runtime.clients = await initializeClients(character, runtime)
    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`)
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`, error)
    console.error(error)
    throw error
  }

  console.log('agent runtime started', runtime.agentId, runtime.character.name)
}

main().catch(console.error)
