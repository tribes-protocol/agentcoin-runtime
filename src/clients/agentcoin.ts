import { UserAPI } from '@/clients/user_api'
import {
  AGENTCOIN_CHANNEL,
  AGENTCOIN_FUN_API_URL,
  AGENTCOIN_SENDER,
  BOT_PRIVATE_KEY
} from '@/common/env'
import { isNull, toJsonTree } from '@/common/functions'
import { CreateMessage, HydratedMessageSchema } from '@/common/types'
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
import { EthAddress, EthAddressSchema } from '@memecoin/sdk'
import { io, Socket } from 'socket.io-client'
import { privateKeyToAddress } from 'viem/accounts'

export class AgentcoinClient {
  private socket: Socket
  private agentAddress: EthAddress
  private userAPI: UserAPI
  private jwtToken: Promise<string> | null = null

  constructor(private readonly runtime: IAgentRuntime) {
    elizaLogger.log('AgentcoinClient constructor')
    this.socket = io(AGENTCOIN_FUN_API_URL, {
      reconnection: true,
      rejectUnauthorized: false,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      withCredentials: true,
      timeout: 20000,
      transports: ['websocket', 'polling']
    })

    this.agentAddress = EthAddressSchema.parse(privateKeyToAddress(BOT_PRIVATE_KEY))
    this.userAPI = new UserAPI()
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
        elizaLogger.log('AgentcoinClient received message', { data })

        const { message } = HydratedMessageSchema.array().parse(data)[0]

        if (message.sender === AGENTCOIN_SENDER) {
          return
        }

        

        const roomId = stringToUuid(AGENTCOIN_CHANNEL)
        const userId = stringToUuid('temp-user') // FIXME: enable once fixed

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
            sender: AGENTCOIN_SENDER,
            clientUuid: responseUuid,
            balance: BigInt(0)
          })
        }

        await this.runtime.processActions(memory, [responseMessage], state, async (newMessage) => {
          try {
            await this.sendMessage({
              text: newMessage.text,
              channel: message.channel,
              sender: AGENTCOIN_SENDER,
              clientUuid: responseUuid,
              balance: BigInt(0)
            })
          } catch (e) {
            console.log(`error sending`, e)
            throw e
          }

          return [memory]
        })

        await this.runtime.evaluate(memory, state)
      } catch (error) {
        elizaLogger.error('Error processing message from agentcoin client', error)
      }
    })
  }

  public stop(): void {
    this.socket.disconnect()
  }

  async sendMessage(message: CreateMessage): Promise<void> {
    if (isNull(this.jwtToken)) {
      this.jwtToken = this.userAPI.login(BOT_PRIVATE_KEY)
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
