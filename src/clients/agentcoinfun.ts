import { AGENTCOIN_FUN_API_URL, TOKEN_ADDRESS } from '@/common/env'
import { isNull, serializeChannel, serializeIdentity } from '@/common/functions'
import { AgentcoinRuntime } from '@/common/runtime'
import {
  ChatChannel,
  ChatChannelKind,
  CoinChannelSchema,
  HydratedMessageSchema,
  UserDmEventSchema
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
  private socket?: Socket

  constructor(private readonly runtime: AgentcoinRuntime) {
    elizaLogger.log('Connecting to Agentcoin API', AGENTCOIN_FUN_API_URL)
  }

  public async start(): Promise<void> {
    if (!isNull(this.socket)) {
      console.log('Agentcoin client already started')
      return
    }

    this.socket = io(AGENTCOIN_FUN_API_URL, {
      reconnection: true,
      rejectUnauthorized: false,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      withCredentials: true,
      timeout: 20000,
      autoConnect: true,
      transports: ['websocket', 'polling'],
      auth: async (cb: (data: unknown) => void) => {
        try {
          const jwtToken = await this.runtime.agentcoin.agent.getJwtAuthToken()
          cb({ jwtToken })
        } catch (error) {
          elizaLogger.error('Error getting JWT token', error)
          cb({})
        }
      }
    })

    this.socket.on('connect', () => {
      elizaLogger.log('Connected to Agentcoin API')
    })
    this.socket.on('disconnect', () => {
      elizaLogger.log('Disconnected from Agentcoin API')
    })

    const coinChannel = CoinChannelSchema.parse({
      kind: ChatChannelKind.COIN,
      chainId: 8453,
      address: TOKEN_ADDRESS
    })

    this.socket.on(serializeChannel(coinChannel), async (data: unknown) => {
      elizaLogger.log('Agentcoin client received coin message', data)
      await this.processMessage(coinChannel, data)
    })

    const identity = await this.runtime.agentcoin.agent.getIdentity()
    const eventName = `user:${serializeIdentity(identity)}`
    elizaLogger.log(
      `agentcoin.fun (${process.env.npm_package_version}) client listening for event`,
      eventName
    )
    this.socket.on(eventName, async (data: unknown) => {
      elizaLogger.log('Agentcoin client received event', data)
      try {
        const event = UserDmEventSchema.parse(data)
        const channel = event.channel

        // validate channel
        if (channel.firstIdentity !== identity && channel.secondIdentity !== identity) {
          elizaLogger.log('Agentcoin client received msg for unknown channel', channel)
          return
        }

        // process message if allowed
        await this.processMessage(channel, [event.message])
      } catch (error) {
        elizaLogger.error('Error processing message from agentcoin client', error)
        console.log(`error processing message`, error, `${error}`)
      }
    })
  }

  public stop(): void {
    this.socket?.disconnect()
    this.socket = undefined
  }

  private async processMessage(channel: ChatChannel, data: unknown): Promise<void> {
    const messages = HydratedMessageSchema.array().parse(data)

    const { message, user } = messages[0]

    if (isNull(message)) {
      elizaLogger.log('AgentcoinClient received empty message')
      return
    }

    const agentcoinService = this.runtime.agentcoin.agent
    const sender = await agentcoinService.getIdentity()

    if (message.sender === sender) {
      return
    }

    const roomId = stringToUuid(serializeChannel(channel))
    const userId = stringToUuid(serializeIdentity(message.sender))
    const messageId = messageIdToUuid(message.id)

    await this.runtime.ensureConnection(roomId, userId)
    await this.runtime.ensureUserExists(
      userId,
      user.username,
      user.username,
      user.identity,
      'agentcoin'
    )

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
    await client.start()
    return client
  },
  stop: async (_runtime: IAgentRuntime, client?: Client) => {
    if (client instanceof AgentcoinClient) {
      client.stop()
    }
  }
}
