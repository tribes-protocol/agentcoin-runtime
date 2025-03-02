import { Agent } from '@/agent'
import { tipForJokeAction } from '@/plugins/tipping/actions/tipForJoke'
import { elizaLogger } from '@elizaos/core'

async function main(): Promise<void> {
  try {
    const agent = new Agent()

    agent.on('message', async (message) => {
      console.log('message', message.text)
      return true
    })

    agent.on('postllm', async (context) => {
      console.log('postllm', context.memory.content.text)
      return true
    })

    agent.register('action', tipForJokeAction)

    await agent.start()
    elizaLogger.success('sdk initialized', agent.agentId)
  } catch {
    process.exit(1)
  }
}

console.log('hello, agent!')
main().catch(elizaLogger.error)
