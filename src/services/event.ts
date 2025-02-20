import { AgentcoinAPI } from '@/apis/agentcoinfun'
import { Character, Identity } from '@/common/types'
import { elizaLogger } from '@elizaos/core'

export class EventService {
  constructor(
    private readonly agentcoinId: Identity,
    private readonly agentcoinCookie: string,
    private readonly agentcoinAPI: AgentcoinAPI
  ) {}

  private heartbeatInterval?: NodeJS.Timeout

  async start(): Promise<void> {
    elizaLogger.log('Starting event service...')
    if (this.heartbeatInterval) {
      elizaLogger.log('Event service already started')
      return
    }

    await this.agentcoinAPI.publishEvent(
      this.agentcoinId,
      {
        kind: 'health',
        status: 'booting'
      },
      { cookie: this.agentcoinCookie }
    )

    // Start heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      void this.publishHeartbeatEvent()
    }, 30000) // Send heartbeat every 30 seconds

    await this.publishHeartbeatEvent()
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }

    await this.agentcoinAPI.publishEvent(
      this.agentcoinId,
      {
        kind: 'health',
        status: 'stopped'
      },
      { cookie: this.agentcoinCookie }
    )
  }

  async publishEnvChangeEvent(envContents: string): Promise<void> {
    const envvarsRecord: Record<string, string> = envContents
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=')
        const value = valueParts.join('=')
        if (key && value) {
          acc[key.trim()] = value.trim()
        }
        return acc
      }, {})

    await this.agentcoinAPI.publishEvent(
      this.agentcoinId,
      {
        kind: 'env_var_change',
        envVars: envvarsRecord
      },
      {
        cookie: this.agentcoinCookie
      }
    )
  }

  async publishCharacterChangeEvent(character: Character): Promise<void> {
    await this.agentcoinAPI.publishEvent(
      this.agentcoinId,
      {
        kind: 'character_change',
        character
      },
      { cookie: this.agentcoinCookie }
    )
  }

  async publishHeartbeatEvent(): Promise<void> {
    await this.agentcoinAPI.publishEvent(
      this.agentcoinId,
      {
        kind: 'health',
        status: 'running'
      },
      { cookie: this.agentcoinCookie }
    )
  }

  async publishCodeChangeEvent(commitHash: string, remoteUrl: string): Promise<void> {
    await this.agentcoinAPI.publishEvent(
      this.agentcoinId,
      {
        kind: 'code_change',
        git: { commit: commitHash, remoteUrl }
      },
      { cookie: this.agentcoinCookie }
    )
  }
}
