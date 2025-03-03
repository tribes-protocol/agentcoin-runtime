import { ContextHandler } from '@/common/types'
import { Action, Provider, Service, UUID } from '@elizaos/core'

export interface IAyaAgent {
  readonly agentId: UUID

  start(): Promise<void>

  on(event: 'llm:pre', handler: ContextHandler): void
  on(event: 'llm:post', handler: ContextHandler): void
  on(event: 'tool:pre', handler: ContextHandler): void
  on(event: 'tool:post', handler: ContextHandler): void

  register(kind: 'service', handler: Service): void
  register(kind: 'provider', handler: Provider): void
  register(kind: 'tool', handler: Action): void
}
