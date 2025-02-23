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

  elizaLogger.success('sdk initialized', sdk.agentId)
}

console.log('hello, agent!')
main().catch(elizaLogger.error)
