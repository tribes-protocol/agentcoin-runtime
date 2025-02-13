import { SentinelClient } from '@/clients/sentinel'
import { UserAPI } from '@/clients/user_api'
import { AGENT_SENTINEL_DIR } from '@/common/constants'
import { AGENTCOIN_CHANNEL, AGENTCOIN_FUN_API_URL } from '@/common/env'
import { isNull, toJsonTree } from '@/common/functions'
import { AgentIdentitySchema, CreateMessage, HydratedMessageSchema } from '@/common/types'
import { messageHandlerTemplate } from '@elizaos/client-direct'
import {
  Client,
  composeContext,
  Content,
  elizaLogger,
  generateMessageResponse,
  getEmbeddingZeroVector,
  IAgentRuntime,
  Memory,
  ModelClass,
  stringToUuid
} from '@elizaos/core'
import os from 'os'
import path from 'path'
import { io, Socket } from 'socket.io-client'

export class AgentcoinClient {
  private socket: Socket
  private userAPI: UserAPI
  private jwtToken: Promise<string> | null = null
  private sentinelClient: SentinelClient
  private agentId: Promise<number>

  constructor(private readonly runtime: IAgentRuntime) {
    this.sentinelClient = new SentinelClient(
      path.join(os.homedir(), AGENT_SENTINEL_DIR, 'sentinel.sock')
    )

    this.agentId = this.sentinelClient.getAgentId()

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

    this.userAPI = new UserAPI(this.sentinelClient, this.agentId)
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
        elizaLogger.log('AgentcoinClient received message ---------->', { data })

        const agentId = await this.agentId

        const { message } = HydratedMessageSchema.array().parse(data)[0]

        if (AgentIdentitySchema.safeParse(message.sender).success) {
          if (AgentIdentitySchema.parse(message.sender).id === agentId) {
            return
          }
        }

        const roomId = stringToUuid(AGENTCOIN_CHANNEL)
        const userId = stringToUuid(message.sender.toString())
        const messageId = stringToUuid(Date.now().toString())

        await this.runtime.ensureConnection(roomId, userId)

        const content: Content = {
          text: message.text,
          attachments: [],
          source: 'agentcoin',
          inReplyTo: undefined
        }

        const userMessage = {
          content,
          userId,
          roomId,
          agentId: this.runtime.agentId
        }

        const memory: Memory = {
          id: stringToUuid(messageId + '-' + userId),
          ...userMessage,
          agentId: this.runtime.agentId,
          userId,
          roomId,
          content,
          createdAt: Date.now()
        }

        await this.runtime.messageManager.addEmbeddingToMemory(memory)
        await this.runtime.messageManager.createMemory(memory)

        let state = await this.runtime.composeState(userMessage, {
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

        const responseMessage: Memory = {
          id: stringToUuid(messageId + '-' + this.runtime.agentId),
          ...userMessage,
          userId: this.runtime.agentId,
          content: response,
          embedding: getEmbeddingZeroVector(),
          createdAt: Date.now()
        }

        await this.runtime.messageManager.createMemory(responseMessage)

        state = await this.runtime.updateRecentMessageState(state)
        const responseUuid = crypto.randomUUID()

        if (response.action !== 'IGNORE') {
          await this.sendMessage({
            text: response.text,
            channel: message.channel,
            sender: {
              id: agentId
            },
            clientUuid: responseUuid
          })
        }

        await this.runtime.processActions(memory, [responseMessage], state, async (newMessage) => {
          try {
            await this.sendMessage({
              text: newMessage.text,
              channel: message.channel,
              sender: {
                id: agentId
              },
              clientUuid: responseUuid
            })
          } catch (e) {
            elizaLogger.error(`error sending`, e)
            throw e
          }

          return [memory]
        })

        await this.runtime.evaluate(memory, state)
      } catch (error) {
        elizaLogger.error('Error processing message from agentcoin client', error)
        console.log(`error processing message`, error, `${error}`)
      }
    })
  }

  public stop(): void {
    this.socket.disconnect()
  }

  async sendMessage(message: CreateMessage): Promise<void> {
    if (isNull(this.jwtToken)) {
      this.jwtToken = this.userAPI.login()
    }

    const cookie = await this.jwtToken

    const response = await fetch(`${AGENTCOIN_FUN_API_URL}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(toJsonTree(message))
    })
    if (response.status !== 200) {
      throw new Error('Failed to send message')
    }
  }
}

export const AgentcoinClientInterface: Client = {
  start: async (_runtime: IAgentRuntime) => {
    elizaLogger.log('AgentcoinClientInterface start')
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
