import { AgentcoinAPI } from '@/apis/agentcoinfun'
import { AGENT_PROVISION_FILE, REGISTRATION_FILE } from '@/common/constants'
import { isNull, toJsonTree } from '@/common/functions'
import {
  AgentProvisionResponse,
  AgentProvisionResponseSchema,
  AgentRegistrationSchema,
  AgentWallet,
  AgentWalletKind,
  CreateMessage,
  HydratedMessage,
  Identity,
  User
} from '@/common/types'
import { IAgentcoinService } from '@/services/interfaces'
import { KeychainService } from '@/services/keychain'
import { elizaLogger, IAgentRuntime, Service, ServiceType } from '@elizaos/core'
import * as fs from 'fs'

export class AgentcoinService extends Service implements IAgentcoinService {
  private cachedCookie: string | undefined
  private cachedIdentity: Identity | undefined

  static get serviceType(): ServiceType {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return 'agentcoin-service' as ServiceType
  }

  constructor(
    private readonly keychain: KeychainService,
    private readonly api: AgentcoinAPI
  ) {
    super()
  }

  async initialize(_: IAgentRuntime): Promise<void> {}

  async getUser(identity: Identity): Promise<User | undefined> {
    return this.api.getUser(identity)
  }

  async getDefaultWallet(kind: AgentWalletKind): Promise<AgentWallet> {
    const cookie = await this.getCookie()
    const identity = await this.getIdentity()
    return this.api.getDefaultWallet(identity, kind, { cookie })
  }

  async getIdentity(): Promise<Identity> {
    if (isNull(this.cachedIdentity)) {
      const { agentId } = AgentProvisionResponseSchema.parse(
        JSON.parse(fs.readFileSync(AGENT_PROVISION_FILE, 'utf-8'))
      )
      this.cachedIdentity = agentId
    }
    return this.cachedIdentity
  }

  async sendMessage(message: CreateMessage): Promise<HydratedMessage> {
    const cookie = await this.getCookie()

    return this.api.sendMessage(message, { cookie })
  }

  public async login(identity: Identity): Promise<string> {
    const message = await this.api.loginMessageToSign(identity)
    const signature = await this.keychain.sign(message)

    if (isNull(signature)) {
      throw new Error('Failed to sign message')
    }

    const token = await this.api.login({ identity, message, signature })

    elizaLogger.success('Agent coin logged in successfully', identity)
    return token
  }

  async provisionIfNeeded(): Promise<void> {
    if (await this.isProvisioned()) {
      return
    }

    elizaLogger.info('Provisioning hardware...')

    const regPath = REGISTRATION_FILE

    if (!fs.existsSync(regPath)) {
      throw new Error('Agent registration not found')
    }

    const { registrationToken: token } = AgentRegistrationSchema.parse(
      JSON.parse(fs.readFileSync(regPath, 'utf-8'))
    )

    const signature = await this.keychain.sign(token)
    const publicKey = this.keychain.publicKey

    const { agentId } = await this.api.provisionAgent(token, signature, publicKey)

    await this.saveProvisionState({ agentId })
    elizaLogger.success('Agent coin provisioned successfully', agentId)
  }

  async getCookie(): Promise<string> {
    if (isNull(this.cachedCookie)) {
      const identity = await this.getIdentity()
      this.cachedCookie = await this.login(identity)
    }
    return this.cachedCookie
  }

  async getJwtAuthToken(): Promise<string> {
    const cookie = await this.getCookie()
    const match = cookie.match(/agent_auth_token=([^;]+)/)
    if (!match) {
      throw new Error('Could not extract JWT token from cookie')
    }
    return match[1]
  }

  // helper private functions

  private async isProvisioned(): Promise<boolean> {
    try {
      return fs.existsSync(AGENT_PROVISION_FILE)
    } catch {
      return false
    }
  }

  private async saveProvisionState(provisionState: AgentProvisionResponse): Promise<void> {
    fs.writeFileSync(AGENT_PROVISION_FILE, JSON.stringify(toJsonTree(provisionState)))
  }
}
