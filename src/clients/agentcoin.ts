import { UserAPI } from '@/clients/user_api'
import { AGENTCOIN_CHANNEL, AGENTCOIN_FUN_API_URL } from '@/common/env'
import { toJsonTree } from '@/common/functions'
import { identityService } from '@/common/services'
import {
  AgentIdentitySchema,
  AgentWallet,
  AgentWalletKind,
  AgentWalletSchema,
  CreateMessage,
  HydratedMessage,
  HydratedMessageSchema
} from '@/common/types'
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

  constructor(
    private readonly runtime: IAgentRuntime,
    private readonly agentId: number,
    private readonly cookie: string
  ) {
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

  async sendMessage(message: CreateMessage): Promise<HydratedMessage> {
    const response = await fetch(`${AGENTCOIN_FUN_API_URL}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: this.cookie },
      body: JSON.stringify(toJsonTree(message))
    })
    if (response.status !== 200) {
      throw new Error('Failed to send message')
    }

    const responseData = await response.json()
    const hydratedMessage = HydratedMessageSchema.parse(responseData)

    return hydratedMessage
  }

  async fetchDefaultWallet(kind: AgentWalletKind): Promise<AgentWallet> {
    const response = await fetch(`${AGENTCOIN_FUN_API_URL}/api/wallets/get-default`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: this.cookie },
      body: JSON.stringify({
        agentId: this.agentId,
        kind
      })
    })
    if (response.status !== 200) {
      throw new Error('Failed to fetch default wallet')
    }

    const responseData = await response.json()
    const wallet = AgentWalletSchema.parse(responseData)

    return wallet
  }

  private async processMessage(data: unknown): Promise<void> {
    elizaLogger.log('AgentcoinClient received message', { data })

    const { message } = HydratedMessageSchema.array().parse(data)[0]

    if (AgentIdentitySchema.safeParse(message.sender).success) {
      if (AgentIdentitySchema.parse(message.sender).id === this.agentId) {
        return
      }
    }

    const roomId = stringToUuid(AGENTCOIN_CHANNEL)
    const userId = stringToUuid(message.sender.toString())
    const messageId = messageIdToUuid(message.id)

    await this.runtime.ensureConnection(roomId, userId)

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
      const agentcoinResponse = await this.sendMessage({
        text: response.text,
        channel: message.channel,
        sender: { id: this.agentId },
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
        await this.sendMessage({
          text: newMessage.text,
          channel: message.channel,
          sender: { id: this.agentId },
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
  start: async (_runtime: IAgentRuntime) => {
    elizaLogger.log('AgentcoinClientInterface start')
    const agentId = await identityService.getAgentId()

    const userAPI = new UserAPI(agentId)
    const cookie = await userAPI.login()

    const client = new AgentcoinClient(_runtime, agentId, cookie)
    client.start()
    return client
  },
  stop: async (_runtime: IAgentRuntime, client?: Client) => {
    if (client instanceof AgentcoinClient) {
      client.stop()
    }
  }
}
