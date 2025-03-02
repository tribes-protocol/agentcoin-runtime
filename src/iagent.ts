import { ContextHandler, NewMessageHandler } from '@/common/types'
import { Action, Provider, Service, UUID } from '@elizaos/core'

export interface IAyaAgent {
  readonly agentId: UUID
  start(): Promise<void>
  on(event: 'message', handler: NewMessageHandler): void
  on(event: 'prellm', handler: ContextHandler): void
  on(event: 'postllm', handler: ContextHandler): void
  on(event: 'preaction', handler: ContextHandler): void
  on(event: 'postaction', handler: ContextHandler): void

  register(kind: 'service', handler: Service): void
  register(kind: 'provider', handler: Provider): void
  register(kind: 'action', handler: Action): void
}
