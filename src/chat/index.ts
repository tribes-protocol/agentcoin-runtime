import { AgentResponseSchema } from '@/common/types'
import { settings } from '@elizaos/core'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.on('SIGINT', () => {
  rl.close()
  process.exit(0)
})

async function handleUserInput(input: string, agentId: string): Promise<void> {
  if (input.toLowerCase() === 'exit') {
    rl.close()
    process.exit(0)
  }

  try {
    const serverPort = parseInt(settings.SERVER_PORT || '3000')

    const response = await fetch(`http://localhost:${serverPort}/${agentId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input,
        userId: 'user',
        userName: 'User'
      })
    })

    const rawData = await response.json()
    console.log({ rawData })
    const data = AgentResponseSchema.array().parse(rawData)
    data.forEach((message) => console.log(`${'Agent'}: ${message.text}`))
  } catch (error) {
    console.error('Error fetching response:', error)
  }
}

export function startChat(agentId: string): () => void {
  function chat(): void {
    rl.question('You: ', async (input) => {
      await handleUserInput(input, agentId)
      if (input.toLowerCase() !== 'exit') {
        chat() // Loop back to ask another question
      }
    })
  }

  return chat
}
