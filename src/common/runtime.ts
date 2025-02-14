import { IAgentcoinService, IWalletService } from '@/services/interfaces'
import {
  Action,
  AgentRuntime,
  Character,
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

export class AgentcoinRuntime extends AgentRuntime {
  public readonly agentcoin: {
    agent: IAgentcoinService
    wallet: IWalletService
  }

  public constructor(opts: {
    agentcoin: {
      wallet: IWalletService
      agent: IAgentcoinService
    }
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
}
