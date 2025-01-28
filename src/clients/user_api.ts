import { AGENTCOIN_FUN_API_URL } from '@/common/env'
import { isNull } from '@/common/functions'
import { EthAddress } from '@memecoin/sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'

export const LoginMessageSchema = z.object({
  message: z.string()
})

export class UserAPI {
  public async login(privateKey: `0x${string}`): Promise<string> {
    const account = privateKeyToAccount(privateKey)
    const message = await this.loginMessageToSign(account.address)
    const signature = await account.signMessage({ message })

    if (isNull(signature)) {
      throw new Error('Failed to sign message')
    }

    return this.generateJWT({ address: account.address, message, signature })
  }

  private async generateJWT({
    address,
    message,
    signature
  }: {
    address: EthAddress
    message: string
    signature: string
  }): Promise<string> {
    const response = await fetch(`${AGENTCOIN_FUN_API_URL}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address,
        message,
        signature
      })
    })

    if (response.status !== 200) {
      throw new Error('Failed to login')
    }

    const setCookie = response.headers.get('set-cookie')
    if (!setCookie) {
      throw new Error('No cookie received from login')
    }

    return setCookie
  }

  private async loginMessageToSign(address: EthAddress): Promise<string> {
    const response = await fetch(`${AGENTCOIN_FUN_API_URL}/api/users/login-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    })
    const data = await response.json()
    const parsed = LoginMessageSchema.parse(data)
    return parsed.message
  }
}
