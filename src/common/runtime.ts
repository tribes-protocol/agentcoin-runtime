import { isNull } from '@/common/functions'
import { IAgentcoinService, IConfigService, IWalletService } from '@/services/interfaces'
import {
  Action,
  AgentRuntime,
  Character,
  elizaLogger,
  Evaluator,
  ICacheManager,
  IDatabaseAdapter,
  IMemoryManager,
  ModelProviderName,
  Plugin,
  Provider,
  Service,
  UUID
} from '@elizaos/core'

interface AgentcoinDependencies {
  agent: IAgentcoinService
  wallet: IWalletService
  config: IConfigService
}

export class AgentcoinRuntime extends AgentRuntime {
  public readonly agentcoin: AgentcoinDependencies

  public constructor(opts: {
    agentcoin: AgentcoinDependencies
    eliza: {
      conversationLength?: number
      agentId?: UUID
      character?: Character
      token: string
      serverUrl?: string
      actions?: Action[]
      evaluators?: Evaluator[]
      plugins?: Plugin[]
      providers?: Provider[]
      modelProvider: ModelProviderName
      services?: Service[]
      managers?: IMemoryManager[]
      databaseAdapter: IDatabaseAdapter
      fetch?: typeof fetch | unknown
      speechModelPath?: string
      cacheManager: ICacheManager
      logging?: boolean
    }
  }) {
    super(opts.eliza)
    this.agentcoin = opts.agentcoin
  }

  async ensureUserRoomConnection(options: {
    roomId: UUID
    userId: UUID
    username?: string
    name?: string
    email?: string
    source?: string
    image?: string
    bio?: string
    ethAddress?: string
  }): Promise<void> {
    const { roomId, userId, username, name, email, source, image, bio, ethAddress } = options

    await Promise.all([
      this.ensureAccountExists({
        userId: this.agentId,
        username: this.character.username ?? 'Agent',
        name: this.character.name ?? 'Agent',
        email: this.character.email ?? 'Agent',
        source
      }),
      this.ensureAccountExists({
        userId,
        username: username ?? 'User' + userId,
        name: name ?? 'User' + userId,
        email,
        source,
        image,
        bio,
        ethAddress
      }),
      this.ensureRoomExists(roomId)
    ])

    await Promise.all([
      this.ensureParticipantInRoom(userId, roomId),
      this.ensureParticipantInRoom(this.agentId, roomId)
    ])
  }

  async ensureAccountExists(params: {
    userId: UUID
    username: string | null
    name: string | null
    email?: string | null
    source?: string | null
    image?: string | null
    bio?: string | null
    ethAddress?: string | null
  }): Promise<void> {
    const { userId, username, name, email, source, image, bio, ethAddress } = params
    const account = await this.databaseAdapter.getAccountById(userId)
    if (isNull(account)) {
      await this.databaseAdapter.createAccount({
        id: userId,
        name,
        username,
        email,
        avatarUrl: image,
        details: { bio, source, ethAddress }
      })

      elizaLogger.success(`User ${username} created successfully.`)
    }
  }
}
