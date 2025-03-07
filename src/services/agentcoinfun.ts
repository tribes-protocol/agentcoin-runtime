import { AgentcoinAPI } from '@/apis/agentcoinfun'
import { isNull, toJsonTree } from '@/common/functions'
import { PathManager } from '@/services/paths'
import {
  AgentIdentity,
  AgentProvisionResponse,
  AgentProvisionResponseSchema,
  AgentRegistrationSchema,
  ChatChannel,
  CreateMessage,
  CredentialsSchema,
  HydratedMessage,
  Identity,
  MessageStatusEnum,
  ServiceKind,
  User
} from '@/common/types'
import { IAgentcoinService } from '@/services/interfaces'
import { KeychainService } from '@/services/keychain'
import { elizaLogger, IAgentRuntime, Service, ServiceType } from '@elizaos/core'
import * as fs from 'fs'
import * as path from 'path'
import { AGENTCOIN_FUN_DIR } from '@/common/constants'
import { AGENTCOIN_FUN_API_URL } from '@/common/env'
import { getDefaultCharacter } from '@/common/character'

export class AgentcoinService extends Service implements IAgentcoinService {
  private cachedCookie: string | undefined
  private cachedIdentity: Identity | undefined

  static get serviceType(): ServiceType {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return ServiceKind.agent as unknown as ServiceType
  }

  constructor(
    private readonly keychain: KeychainService,
    private readonly api: AgentcoinAPI,
    private readonly pathManager: PathManager
  ) {
    super()
  }

  async initialize(_: IAgentRuntime): Promise<void> {}

  async getUser(identity: Identity): Promise<User | undefined> {
    return this.api.getUser(identity)
  }

  async getIdentity(): Promise<Identity> {
    if (isNull(this.cachedIdentity)) {
      const { agentId } = AgentProvisionResponseSchema.parse(
        JSON.parse(fs.readFileSync(this.pathManager.AGENT_PROVISION_FILE, 'utf-8'))
      )
      this.cachedIdentity = agentId
    }
    return this.cachedIdentity
  }

  async sendStatus(channel: ChatChannel, status: MessageStatusEnum): Promise<void> {
    const cookie = await this.getCookie()

    await this.api.sendStatus(
      {
        channel,
        status
      },
      { cookie }
    )
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

    const regPath = this.pathManager.REGISTRATION_FILE

    if (!fs.existsSync(regPath)) {
      const agentId = await this.provisionPureAgent()
      await this.saveProvisionState({ agentId })
      elizaLogger.success('Agent coin provisioned successfully', agentId)
      return
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
    const match = cookie.match(/jwt_auth_token=([^;]+)/)
    if (!match) {
      throw new Error('Could not extract JWT token from cookie')
    }
    return match[1]
  }

  async provisionPureAgent(): Promise<AgentIdentity> {
    let token = await this.getCliAuthToken()
    if (isNull(token)) {
      token = await this.createCliAuthAndWaitForToken()
    }

    const message = this.keychain.publicKey
    const signature = await this.keychain.sign(message)

    const { agentId } = await this.api.createAgentFromCli(
      message,
      this.keychain.publicKey,
      signature,
      `jwt_auth_token=${token}`
    )

    await this.createCharacterFile()

    // Display agent creation success message
    const agentUrl = `${AGENTCOIN_FUN_API_URL}/agent/${agentId}`
    const boxWidth = Math.max(70, agentUrl.length + 6) // Ensure minimum width of 70 chars

    console.log('\n┌' + '─'.repeat(boxWidth) + '┐')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('│' + '  🎉 Congratulations! Your agent is created  '.padEnd(boxWidth, ' ') + '│')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('│' + '  Check it out here:'.padEnd(boxWidth, ' ') + '│')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('│' + `  ${agentUrl}`.padEnd(boxWidth, ' ') + '│')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('└' + '─'.repeat(boxWidth) + '┘\n')

    return agentId
  }

  async getCliAuthToken(): Promise<string | undefined> {
    const credentialsPath = path.join(AGENTCOIN_FUN_DIR, 'credentials.json')
    if (!fs.existsSync(credentialsPath)) {
      return undefined
    }
    const credentials = CredentialsSchema.parse(
      JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))
    )
    return credentials.token
  }

  async createCliAuthAndWaitForToken(): Promise<string> {
    // Create the CLI auth request and get the ID
    const id = await this.api.createCliAuthRequest()

    // Calculate the box width based on the URL length
    const url = `${AGENTCOIN_FUN_API_URL}/user/login?id=${id}`
    const boxWidth = Math.max(70, url.length + 6) // Ensure minimum width of 70 chars

    // Print a fancy bordered URL message for the user
    console.log('\n┌' + '─'.repeat(boxWidth) + '┐')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('│' + '  🔐 Authentication Required  '.padEnd(boxWidth, ' ') + '│')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('│' + '  Please visit:'.padEnd(boxWidth, ' ') + '│')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('│' + `  ${url}`.padEnd(boxWidth, ' ') + '│')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('│' + '  Waiting for authentication...'.padEnd(boxWidth, ' ') + '│')
    console.log('│' + ' '.repeat(boxWidth) + '│')
    console.log('└' + '─'.repeat(boxWidth) + '┘\n')

    // Poll for the response token
    let token: string | undefined
    let dots = 0
    const updateWaitingMessage = (): void => {
      process.stdout.write(`\r  Waiting${'.'.repeat(dots)}${' '.repeat(3 - dots)}`)
      dots = (dots + 1) % 4
    }

    const waitingInterval = setInterval(updateWaitingMessage, 500)

    try {
      while (isNull(token)) {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        try {
          token = await this.api.getCliAuthRequest(id)
          if (token) {
            clearInterval(waitingInterval)
            console.log('\n\n┌' + '─'.repeat(boxWidth) + '┐')
            console.log('│' + ' '.repeat(boxWidth) + '│')
            console.log('│' + '  ✅ Authentication successful!'.padEnd(boxWidth, ' ') + '│')
            console.log('│' + ' '.repeat(boxWidth) + '│')
            console.log('└' + '─'.repeat(boxWidth) + '┘\n')

            // Save the token to credentials.json
            const credentialsPath = path.join(AGENTCOIN_FUN_DIR, 'credentials.json')
            fs.writeFileSync(
              credentialsPath,
              JSON.stringify({ token, createdAt: new Date().toISOString() }, null, 2)
            )

            elizaLogger.success('Credentials saved to', credentialsPath)
            return token
          }
        } catch (error) {
          clearInterval(waitingInterval)
          elizaLogger.error('Error polling for CLI auth token', error)
          throw new Error('Failed to authenticate via CLI')
        }
      }
    } catch (error) {
      clearInterval(waitingInterval)
      throw error
    }

    return token
  }

  // helper private functions

  private async isProvisioned(): Promise<boolean> {
    try {
      return fs.existsSync(this.pathManager.AGENT_PROVISION_FILE)
    } catch {
      return false
    }
  }

  private async saveProvisionState(provisionState: AgentProvisionResponse): Promise<void> {
    fs.writeFileSync(
      this.pathManager.AGENT_PROVISION_FILE,
      JSON.stringify(toJsonTree(provisionState))
    )
  }

  private async createCharacterFile(): Promise<void> {
    const character = getDefaultCharacter()
    fs.writeFileSync(this.pathManager.CHARACTER_FILE, JSON.stringify(toJsonTree(character)))

    // FIXME: avp: temp fix to ensure env.production is created
    const envFile = this.pathManager.ENV_FILE
    if (!fs.existsSync(envFile)) {
      fs.writeFileSync(envFile, '')
    }
  }
}
