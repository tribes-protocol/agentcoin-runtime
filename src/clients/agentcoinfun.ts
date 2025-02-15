import { AGENTCOIN_CHANNEL, AGENTCOIN_FUN_API_URL } from '@/common/env'
import { serializeIdentity } from '@/common/functions'
import { AgentcoinRuntime } from '@/common/runtime'
import { HydratedMessageSchema } from '@/common/types'
import { GetUserStore } from '@/plugins/agentcoin/stores/users'
import { messageHandlerTemplate } from '@elizaos/client-direct'

import {
  Client,
  composeContext,
  elizaLogger,
  generateMessageResponse,
  IAgentRuntime,
  Memory,
  ModelClass,
  stringToUuid,
  UUID
} from '@elizaos/core'
import { io, Socket } from 'socket.io-client'

function messageIdToUuid(messageId: number): UUID {
  return stringToUuid('agentcoin:' + messageId.toString())
}

export class AgentcoinClient {
  private socket: Socket

  constructor(private readonly runtime: AgentcoinRuntime) {
    elizaLogger.log('Connecting to Agentcoin API', AGENTCOIN_FUN_API_URL)
    this.socket = io(AGENTCOIN_FUN_API_URL, {
      reconnection: true,
      rejectUnauthorized: false,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      withCredentials: true,
      timeout: 20000,
      autoConnect: true,
      transports: ['websocket', 'polling']
    })
  }

  public start(): void {
    this.socket.on('connect', () => {
      console.log('Connected to Agentcoin API')
    })
    this.socket.on('disconnect', () => {
      console.log('Disconnected from Agentcoin API')
    })

    this.socket.on(AGENTCOIN_CHANNEL, async (data) => {
      try {
        await this.processMessage(data)
      } catch (error) {
        elizaLogger.error('Error processing message from agentcoin client', error)
        console.log(`error processing message`, error, `${error}`)
      }
    })
  }

  public stop(): void {
    this.socket.disconnect()
  }

  private async processMessage(data: unknown): Promise<void> {
    elizaLogger.log('AgentcoinClient received message', { data })

    const { message } = HydratedMessageSchema.parse(data)
    const agentcoinService = this.runtime.agentcoin.agent
    const sender = await agentcoinService.getIdentity()

    if (message.sender === sender) {
      return
    }

    const roomId = stringToUuid(AGENTCOIN_CHANNEL)
    const userId = stringToUuid(serializeIdentity(message.sender))
    const messageId = messageIdToUuid(message.id)

    await this.runtime.ensureConnection(roomId, userId)

    const userStore = GetUserStore(this.runtime)
    await userStore.linkUserIdentity(message.sender)

    const memory: Memory = {
      id: messageId,
      agentId: this.runtime.agentId,
      userId,
      roomId,
      content: {
        text: message.text,
        attachments: [],
        source: 'agentcoin',
        inReplyTo: undefined,
        agentCoinMessageId: message.id
      },
      createdAt: Date.now(),
      unique: true
    }

    await this.runtime.messageManager.addEmbeddingToMemory(memory)
    await this.runtime.messageManager.createMemory(memory)

    let state = await this.runtime.composeState(memory, {
      agentName: this.runtime.character.name
    })

    const context = composeContext({
      state,
      template: messageHandlerTemplate
    })

    const response = await generateMessageResponse({
      runtime: this.runtime,
      context,
      modelClass: ModelClass.LARGE
    })

    const messageResponses: Memory[] = []
    if (response.action !== 'IGNORE') {
      const agentcoinResponse = await agentcoinService.sendMessage({
        text: response.text,
        sender,
        channel: message.channel,
        clientUuid: crypto.randomUUID()
      })

      const responseMessage: Memory = {
        id: stringToUuid(messageId + '-' + this.runtime.agentId),
        agentId: this.runtime.agentId,
        userId: this.runtime.agentId,
        roomId,
        content: {
          ...response,
          source: 'agentcoin',
          inReplyTo: messageId,
          agentCoinMessageId: agentcoinResponse.message.id
        },
        createdAt: Date.now(),
        unique: true
      }

      await this.runtime.messageManager.addEmbeddingToMemory(responseMessage)
      await this.runtime.messageManager.createMemory(responseMessage)

      messageResponses.push(responseMessage)

      state = await this.runtime.updateRecentMessageState(state)
    } else {
      elizaLogger.log('Agentcoin response is IGNORE', response)
    }

    await this.runtime.processActions(memory, messageResponses, state, async (newMessage) => {
      try {
        await agentcoinService.sendMessage({
          text: newMessage.text,
          sender,
          channel: message.channel,
          clientUuid: crypto.randomUUID()
        })
      } catch (e) {
        elizaLogger.error(`error sending`, e)
        throw e
      }

      return [memory]
    })

    await this.runtime.evaluate(memory, state)
  }
}

export const AgentcoinClientInterface: Client = {
  start: async (_runtime: AgentcoinRuntime) => {
    const client = new AgentcoinClient(_runtime)
    client.start()
    return client
  },
  stop: async (_runtime: IAgentRuntime, client?: Client) => {
    if (client instanceof AgentcoinClient) {
      client.stop()
    }
  }
}
