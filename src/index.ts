import { startChat } from '@/chat'
import { initializeClients } from '@/clients'
import { getTokenForProvider } from '@/common/config'
import { initializeDatabase } from '@/common/db'
import { watchGitRepository } from '@/git/watcher'
import memecoinPlugin from '@/plugins/memecoin'
import {
  Action,
  AgentRuntime,
  CacheManager,
  DbCacheAdapter,
  elizaLogger,
  ICacheManager,
  IDatabaseAdapter,
  Plugin,
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
  token: string
): AgentRuntime {
  elizaLogger.success(elizaLogger.successesTitle, 'Creating runtime for character', character.name)

  const nodePlugin = createNodePlugin()

  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    plugins: [bootstrapPlugin, nodePlugin, memecoinPlugin],
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache
  })
}

async function startAgent(character: Character): Promise<AgentRuntime> {
  let runtime: AgentRuntime | undefined

  try {
    const token = getTokenForProvider(character.modelProvider, character)

    const db = initializeDatabase()

    await db.init()

    const cache = new CacheManager(new DbCacheAdapter(db, character.id))

    runtime = createAgent(character, db, cache, token)

    const shutdown = async (signal: string): Promise<void> => {
      elizaLogger.log(`\nReceived ${signal} signal. Stopping agent...`)
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

    if (process.env.NODE_ENV !== 'production') {
      elizaLogger.log("Chat started. Type 'exit' to quit.")
      const chat = startChat(runtime.agentId)
      chat()
    }

    return runtime
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`, error)
    console.error(error)
    throw error
  }
}

async function restartAgent(
  runtime: AgentRuntime,
  newActions?: Action[],
  newPlugins?: Plugin[],
  newCharacter?: Character
): Promise<AgentRuntime> {
  try {
    await runtime.stop()
    elizaLogger.debug('Agent stopped for restart')

    if (newActions) {
      runtime.actions = newActions
    }

    if (newPlugins) {
      runtime.plugins = newPlugins
    }

    if (newCharacter) {
      runtime.character = newCharacter
    }

    await runtime.initialize()
    runtime.clients = await initializeClients(runtime.character, runtime)
    elizaLogger.debug(`Restarted ${runtime.character.name} as ${runtime.agentId}`)

    return runtime
  } catch (error) {
    elizaLogger.error('Error restarting agent:', error)
    throw error
  }
}

export { restartAgent, startAgent }

async function loadCharacter(): Promise<Character> {
  const characterFile = process.env.CHARACTER_FILE
  const character = fs.readFileSync(characterFile, 'utf8')
  return JSON.parse(character)
}

async function main(): Promise<void> {
  const character = await loadCharacter()
  const runtime = await startAgent(character)
  console.log('agent runtime started', runtime)

  // starts watching for changes in the git repository, and restarts the agent if there are changes
  void watchGitRepository()

  // console.log('restarting agent')
  // await restartAgent(runtime)
}

main().catch(console.error)
