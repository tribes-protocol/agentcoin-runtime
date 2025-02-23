import { AgentcoinSDK } from '@/sdk'
import { elizaLogger } from '@elizaos/core'
async function main(): Promise<void> {
  const sdk = await AgentcoinSDK.start()

  elizaLogger.success('sdk initialized', sdk.agentId)
}

console.log('hello, agent!')
main().catch(elizaLogger.error)
