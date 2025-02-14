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
  signedTxn: z.string()
})

export class WalletService {
  constructor(private readonly client: AxiosInstance) {}

  async signPersonalMessage(walletId: number, message: string): Promise<string> {
    const response = await this.client.post('/sign-with-wallet', { walletId, message })
    return SignatureSchema.parse(response.data).signature
  }

  async signTransaction(
    walletAddress: WalletAddress,
    subOrganizationId: string,
    transaction: Transaction
  ): Promise<string> {
    const response = await this.client.post('/sign-txn-with-wallet', {
      walletAddress,
      subOrganizationId,
      transaction
    })
    return SignedTransactionSchema.parse(response.data).signedTxn
  }
}
