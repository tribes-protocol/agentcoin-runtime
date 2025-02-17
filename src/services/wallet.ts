import { BASE_RPC_URL } from '@/common/env'
import { isNull } from '@/common/functions'
import { AgentWallet, HexString, Transaction } from '@/common/types'
import { IWalletService } from '@/services/interfaces'
import { TurnkeyClient } from '@turnkey/http'
import { ApiKeyStamper } from '@turnkey/sdk-server'
import { createAccountWithAddress } from '@turnkey/viem'
import { Account, createWalletClient, getAddress, http, WalletClient } from 'viem'
import { base } from 'viem/chains'

export class WalletService implements IWalletService {
  private readonly turnkey: TurnkeyClient

  constructor(apiKeyStamper: ApiKeyStamper) {
    this.turnkey = new TurnkeyClient(
      {
        baseUrl: 'https://api.turnkey.com'
      },
      apiKeyStamper
    )
  }

  async signPersonalMessage(wallet: AgentWallet, message: string): Promise<string> {
    const account = this.getAccount(wallet)
    if (isNull(account.signMessage)) {
      throw new Error('Failed to sign message. missing signMessage function')
    }
    return account.signMessage({ message })
  }

  async signAndSubmitTransaction(
    wallet: AgentWallet,
    transaction: Transaction
  ): Promise<HexString> {
    if (!isNull(transaction.chainId) && transaction.chainId !== base.id) {
      throw new Error(`Unsupported chainId: ${transaction.chainId}`)
    }

    const client: WalletClient = createWalletClient({
      account: this.getAccount(wallet),
      chain: base,
      transport: http(BASE_RPC_URL)
    })

    const txHash = await client.sendTransaction({
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
      account: client.account,
      chain: base,
      // FIXME: hish - tackle kzg
      kzg: undefined
    })

    return txHash
  }

  private getAccount(wallet: AgentWallet): Account {
    const address = getAddress(wallet.address)
    const account = createAccountWithAddress({
      client: this.turnkey,
      organizationId: wallet.subOrganizationId,
      signWith: address,
      ethereumAddress: address
    })
    return account
  }
}
