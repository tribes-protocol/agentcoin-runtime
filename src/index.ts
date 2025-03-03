import { Agent } from '@/agent'
import { tipForJokeAction } from '@/plugins/tipping/actions/tipForJoke'
import { elizaLogger } from '@elizaos/core'

async function main(): Promise<void> {
  try {
    const agent = new Agent()

    agent.on('llm:pre', async (context) => {
      console.log('llm:pre', context.memory)
      return true
    })

    agent.on('llm:post', async (context) => {
      console.log('llm:post', context.memory)
      return true
    })

    agent.register('tool', tipForJokeAction)

    await agent.start()
    elizaLogger.success('sdk initialized', agent.agentId)
  } catch {
    process.exit(1)
  }
}

console.log('hello, agent!')
main().catch(elizaLogger.error)
