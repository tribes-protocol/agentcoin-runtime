import { WalletAddress } from '@/common/types'
import { AxiosInstance } from 'axios'
import { z } from 'zod'

interface Transaction {
  to: string
  value?: bigint
  data?: string
}

const SignatureSchema = z.object({
  signature: z.string()
})

const SignedTransactionSchema = z.object({
  txHash: z.string()
})

export class WalletService {
  constructor(private readonly client: AxiosInstance) {}

  async signPersonalMessage(
    walletAddress: WalletAddress,
    subOrganizationId: string,
    message: string
  ): Promise<string> {
    const response = await this.client.post('/sign-with-wallet', {
      walletAddress,
      subOrganizationId,
      message
    })
    return SignatureSchema.parse(response.data).signature
  }

  async signTransaction(
    walletAddress: WalletAddress,
    subOrganizationId: string,
    transaction: Transaction,
    chainId: number
  ): Promise<string> {
    const response = await this.client.post('/sign-txn-with-wallet', {
      walletAddress,
      subOrganizationId,
      transaction,
      chainId
    })
    return SignedTransactionSchema.parse(response.data).txHash
  }
}
