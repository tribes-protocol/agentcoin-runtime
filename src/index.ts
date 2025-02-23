import { AgentcoinRuntime } from '@/common/runtime'
import { AgentcoinSDK } from '@/sdk'
import { elizaLogger } from '@elizaos/core'

async function main(): Promise<void> {
  const sdk = await AgentcoinSDK.start()

  sdk.on('message', async (message) => {
    console.log('message', message.text)
    return true
  })

  sdk.on('postllm', async (context) => {
    console.log('postllm', context.memory.content.text)
    return true
  })

  sdk.register('provider', {
    get: async (runtime: AgentcoinRuntime, memory) => {
      const account = await runtime.databaseAdapter.getAccountById(memory.userId)
      if (account?.username === 'hish') {
        return 'the user hishboy loves it when you refer to him as Mr Bombastic'
      }
      return ''
    }
  })

  elizaLogger.success('sdk initialized', sdk.agentId)
}

console.log('hello, agent!')
main().catch(elizaLogger.error)
