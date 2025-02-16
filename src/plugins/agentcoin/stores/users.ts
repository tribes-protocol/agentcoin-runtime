import {
  deserializeIdentity,
  isNull,
  isRequiredString,
  serializeIdentity,
  toJsonTree
} from '@/common/functions'
import { Identity, User, UserSchema } from '@/common/types'
import { Content, IAgentRuntime, IMemoryManager, Memory, stringToUuid, UUID } from '@elizaos/core'

// Agentcoin User Store
class UserStore {
  private roomId: UUID = stringToUuid('agentcoin.fun/users')

  private get db(): IMemoryManager {
    return this.runtime.descriptionManager
  }

  constructor(private runtime: IAgentRuntime) {}

  async getUser(userId: UUID): Promise<User | undefined> {
    const memory = await this.db.getMemoryById(userId)

    // FIXME: hish - if updatedAt is more than 10 minutes
    // old, we should return undefined to force a refresh.

    if (isNull(memory)) {
      return undefined
    }

    if (memory.content.text.trim() === '') {
      return undefined
    }

    return UserSchema.parse(JSON.parse(memory.content.text))
  }

  async saveUser(user: User): Promise<void> {
    const stringIdentity = serializeIdentity(user.identity)
    const userId = stringToUuid(stringIdentity)
    const memory = this.createUserMemory(userId, {
      text: JSON.stringify(toJsonTree(user), null, 2),
      attachments: [],
      inReplyTo: undefined,
      identity: stringIdentity
    })

    // FIXME: hish - do I need to delete old memory to update it?

    await this.db.addEmbeddingToMemory(memory)
    await this.db.createMemory(memory)
  }

  async getUserIdentity(userId: UUID): Promise<Identity | undefined> {
    const memory = await this.db.getMemoryById(userId)
    if (isNull(memory) || !isRequiredString(memory.content.identity)) {
      return undefined
    }
    return deserializeIdentity(memory.content.identity)
  }

  async linkUserIdentity(identity: Identity): Promise<void> {
    const userId = stringToUuid(serializeIdentity(identity))
    let memory = await this.db.getMemoryById(userId)

    if (isNull(memory)) {
      memory = this.createUserMemory(userId, {
        text: '',
        identity: serializeIdentity(identity)
      })
      await this.db.createMemory(memory)
    }
  }

  private createUserMemory(id: UUID, content: Content): Memory {
    const memory: Memory = {
      id,
      agentId: this.runtime.agentId,
      userId: id,
      roomId: this.roomId,
      content: {
        ...content,
        updatedAt: Date.now(), // FIXME: hish - handle refreshing the user
        source: 'agentcoin'
      }
    }

    return memory
  }
}
const cache = new Map<UUID, UserStore>()

export function GetUserStore(runtime: IAgentRuntime): UserStore {
  let cached = cache.get(runtime.agentId)
  if (isNull(cached)) {
    cached = new UserStore(runtime)
    cache.set(runtime.agentId, cached)
  }
  return cached
}
