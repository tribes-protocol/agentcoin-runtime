import { AyaOS } from '@/ayaos'
import { elizaLogger } from '@elizaos/core'

async function main(): Promise<void> {
  try {
    const sdk = await AyaOS.start()

    sdk.on('message', async (message) => {
      console.log('message', message.text)
      return true
    })

    sdk.on('postllm', async (context) => {
      console.log('postllm', context.memory.content.text)
      return true
    })

    elizaLogger.success('sdk initialized', sdk.agentId)
  } catch {
    process.exit(1)
  }
}

console.log('hello, agent!')
main().catch(elizaLogger.error)
