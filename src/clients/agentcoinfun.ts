import { CHARACTER_FILE, ENV_FILE } from '@/common/constants'
import { AGENT_ADMIN_PUBLIC_KEY, AGENTCOIN_FUN_API_URL, TOKEN_ADDRESS } from '@/common/env'
import {
  isNull,
  isRequiredString,
  isValidSignature,
  serializeChannel,
  serializeIdentity
} from '@/common/functions'
import { AgentcoinRuntime } from '@/common/runtime'
import {
  Character,
  ChatChannel,
  ChatChannelKind,
  CoinChannelSchema,
  EthAddressSchema,
  HydratedMessageSchema,
  SentinelCommand,
  SentinelCommandSchema,
  UserDmEventSchema
} from '@/common/types'
import * as fs from 'fs'

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
    elizaLogger.info('Connecting to Agentcoin API', AGENTCOIN_FUN_API_URL)
  }

  public async start(): Promise<void> {
    if (!isNull(this.socket)) {
      elizaLogger.info('Agentcoin client already started')
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
      extraHeaders: {
        Cookie: await this.runtime.agentcoin.agent.getCookie()
      },
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
      elizaLogger.info('Connected to Agentcoin API')
    })
    this.socket.on('disconnect', () => {
      elizaLogger.info('Disconnected from Agentcoin API')
    })

    const coinChannel = CoinChannelSchema.parse({
      kind: ChatChannelKind.COIN,
      chainId: 8453,
      address: TOKEN_ADDRESS
    })

    this.socket.on(serializeChannel(coinChannel), async (data: unknown) => {
      elizaLogger.info('Agentcoin client received coin message', data)
      await this.processMessage(coinChannel, data)
    })

    const identity = await this.runtime.agentcoin.agent.getIdentity()
    const eventName = `user:${serializeIdentity(identity)}`
    elizaLogger.info(
      `agentcoin.fun (${process.env.npm_package_version}) client listening for event`,
      eventName
    )

    // listen on DMs
    this.socket.on(eventName, async (data: unknown) => {
      elizaLogger.info('Agentcoin client received event', data)
      try {
        const event = UserDmEventSchema.parse(data)
        const channel = event.channel

        // validate channel
        if (channel.firstIdentity !== identity && channel.secondIdentity !== identity) {
          elizaLogger.info('Agentcoin client received msg for unknown channel', channel)
          return
        }

        // process message if allowed
        await this.processMessage(channel, [event.message])
      } catch (error) {
        elizaLogger.error('Error processing message from agentcoin client', error)
      }
    })

    // listen on admin commands
    this.socket.on(`admin:${identity}`, async (payload: string) => {
      try {
        const jsonObj = JSON.parse(payload)
        const { content, signature } = jsonObj
        if (!isRequiredString(content) || !isRequiredString(signature)) {
          throw new Error('Invalid payload')
        }

        if (!isValidSignature(content, AGENT_ADMIN_PUBLIC_KEY, signature)) {
          throw new Error('Invalid signature')
        }

        const command = SentinelCommandSchema.parse(JSON.parse(content))
        await this.handleAdminCommand(command)
      } catch (e) {
        console.error('Error handling admin command:', e, payload)
      }
    })
  }

  private async handleAdminCommand(command: SentinelCommand): Promise<void> {
    switch (command.kind) {
      case 'set_git':
        console.log('ignoring set_git. sentinel service is handling this', command)
        break
      case 'set_character_n_envvars':
        await this.handleSetCharacterAndEnvvars(command.character, command.envVars)
        break
      case 'set_knowledge':
        console.log('ignoring set_knowledge', command)
        break
      case 'delete_knowledge':
        console.log('ignoring delete_knowledge', command)
        break
      default:
        throw new Error('Invalid command')
    }
  }

  private async handleSetCharacterAndEnvvars(
    character: Character,
    envVars: Record<string, string>
  ): Promise<void> {
    // write the character to the character file
    await fs.promises.writeFile(CHARACTER_FILE, JSON.stringify(character, null, 2))

    // write the env vars to the env file
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    await fs.promises.writeFile(ENV_FILE, envContent)

    // notify config service
    await this.runtime.agentcoin.config.checkEnvAndCharacterUpdate()
  }

  public stop(): void {
    this.socket?.disconnect()
    this.socket = undefined
  }

  private async processMessage(channel: ChatChannel, data: unknown): Promise<void> {
    const messages = HydratedMessageSchema.array().parse(data)

    const { message, user } = messages[0]

    if (isNull(message)) {
      elizaLogger.info('AgentcoinClient received empty message')
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

    await this.runtime.ensureUserRoomConnection({
      roomId,
      userId,
      username: user.username,
      name: user.username,
      email: user.identity,
      bio: user.bio,
      ethAddress: EthAddressSchema.safeParse(user.identity).success ? user.identity : undefined,
      source: 'agentcoin'
    })

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
      elizaLogger.info('Agentcoin response is IGNORE', response)
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
