import { AxiosInstance } from 'axios'
import { z } from 'zod'

const SignatureSchema = z.object({
  signature: z.string()
})

const AgentIdSchema = z.object({
  agentId: z.coerce.number()
})

export class IdentityService {
  constructor(private readonly client: AxiosInstance) {}

  async sign(walletId: number, message: string): Promise<string> {
    const response = await this.client.post('/sign-with-pubkey', { walletId, message })
    return SignatureSchema.parse(response.data).signature
  }

  async getAgentId(): Promise<number> {
    const response = await this.client.get('/agent-id')
    return AgentIdSchema.parse(response.data).agentId
  }
}
