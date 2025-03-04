import { Agent } from '@/agent'
import { tipForJokeAction } from '@/plugins/tipping/actions/tipForJoke'
import { elizaLogger } from '@elizaos/core'

async function main(): Promise<void> {
  try {
    console.log('hello, agent!')
    const agent = new Agent()
    console.log('agent created')
    agent.on('llm:pre', async (context) => {
      console.log('llm:pre', context.memory)
      return true
    })
    console.log('llm:pre registered')

    agent.on('llm:post', async (context) => {
      console.log('llm:post', context.memory)
      return true
    })
    console.log('llm:post registered')

    agent.register('tool', tipForJokeAction)

    await agent.start()
    console.log('tool registered')
    console.log('starting agent...')
    console.log('agent started', agent.agentId)
  } catch (error) {
    console.error(`error: ${error}`, error)
    process.exit(1)
  }
}

main().catch(elizaLogger.error)
