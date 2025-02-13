import { SentinelClient } from '@/clients/sentinel'
import { AGENTCOIN_FUN_API_URL } from '@/common/env'
import { isNull } from '@/common/functions'
import { Identity } from '@/common/types'
import { z } from 'zod'

export const LoginMessageSchema = z.object({
  message: z.string()
})

export class UserAPI {
  constructor(
    private readonly sentinelClient: SentinelClient,
    private readonly agentId: Promise<number>
  ) {}

  public async login(): Promise<string> {
    const agentId = await this.agentId
    const message = await this.loginMessageToSign({ id: agentId })
    const signature = await this.sentinelClient.signWithPubKey(message)

    if (isNull(signature)) {
      throw new Error('Failed to sign message')
    }

    return this.generateJWT({ identity: { id: agentId }, message, signature })
  }

  private async generateJWT({
    identity,
    message,
    signature
  }: {
    identity: Identity
    message: string
    signature: string
  }): Promise<string> {
    const response = await fetch(`${AGENTCOIN_FUN_API_URL}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identity,
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

  private async loginMessageToSign(identity: Identity): Promise<string> {
    const response = await fetch(`${AGENTCOIN_FUN_API_URL}/api/users/login-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity })
    })
    const data = await response.json()
    const parsed = LoginMessageSchema.parse(data)
    return parsed.message
  }
}
