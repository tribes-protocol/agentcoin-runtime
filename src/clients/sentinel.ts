import axios, { AxiosInstance } from 'axios'
import { z } from 'zod'
interface Transaction {
  to: string
  value?: bigint
  data?: string
  nonce: number
  gasLimit: bigint
  chainId: number
}

const SignatureSchema = z.object({
  signature: z.string()
})

const SignedTransactionSchema = z.object({
  signedTxn: z.string()
})

const AgentIdSchema = z.object({
  agentId: z.coerce.number()
})

export class SentinelClient {
  private readonly client: AxiosInstance

  constructor(socketPath: string) {
    this.client = axios.create({
      socketPath,
      baseURL: 'http://unix',
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  async signWithPubKey(message: string): Promise<string> {
    const response = await this.client.post('/sign-with-pubkey', { message })
    return SignatureSchema.parse(response.data).signature
  }

  async signWithWallet(walletId: number, message: string): Promise<string> {
    const response = await this.client.post('/sign-with-wallet', { walletId, message })
    return SignatureSchema.parse(response.data).signature
  }

  async signTxnWithWallet(walletId: number, transaction: Transaction): Promise<string> {
    const response = await this.client.post('/sign-txn-with-wallet', { walletId, transaction })
    console.log('got response', response.data)
    return SignedTransactionSchema.parse(response.data).signedTxn
  }

  async getAgentId(): Promise<number> {
    const response = await this.client.get('/agent-id')
    return AgentIdSchema.parse(response.data).agentId
  }
}
