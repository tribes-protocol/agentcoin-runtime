import { isNull } from '@/common/functions'
import { Context, SdkEventKind } from '@/common/types'
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
  ServiceType,
  UUID
} from '@elizaos/core'

type AgentEventHandler = (event: SdkEventKind, params: Context) => Promise<boolean>

export class AgentcoinRuntime extends AgentRuntime {
  private eventHandler: AgentEventHandler | undefined

  public constructor(opts: {
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
  }

  async initialize(options?: { eventHandler: AgentEventHandler }): Promise<void> {
    await super.initialize()

    if (!isNull(this.eventHandler)) {
      throw new Error('AgentcoinRuntime already initialized')
    }

    if (isNull(options?.eventHandler)) {
      throw new Error('AgentcoinRuntime event handler not provided')
    }

    this.eventHandler = options.eventHandler
  }

  async handle(event: SdkEventKind, params: Context): Promise<boolean> {
    if (isNull(this.eventHandler)) {
      throw new Error('AgentcoinRuntime not initialized')
    }

    return this.eventHandler(event, params)
  }

  getService<T extends Service>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service: ServiceType | string | ((new (...args: any[]) => T) & { serviceType: ServiceType })
  ): T | null {
    if (typeof service === 'function') {
      // Handle case where a class constructor is passed
      const serviceType = service.serviceType
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return super.getService(serviceType) as T
    }
    // Handle existing case where ServiceType or string is passed
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return super.getService(service as ServiceType) as T
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
