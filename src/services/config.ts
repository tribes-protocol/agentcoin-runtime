import { CHARACTER_FILE, CODE_DIR, ENV_FILE } from '@/common/constants'
import { isNull, isRequiredString } from '@/common/functions'
import { CharacterSchema } from '@/common/types'
import { EventService } from '@/services/event'
import { elizaLogger } from '@elizaos/core'
import crypto from 'crypto'
import fs from 'fs'
import simpleGit from 'simple-git'

export class ConfigService {
  private isRunning = false
  private gitCommitHash: string | undefined
  private envvarsChecksum: string | undefined
  private characterChecksum: string | undefined

  constructor(private readonly eventService: EventService) {}

  async start(): Promise<void> {
    elizaLogger.log('Starting config service...')
    // disable in dev mode
    if (process.env.NODE_ENV !== 'production') {
      elizaLogger.log('Config service disabled in dev mode')
      return
    }

    if (this.isRunning) {
      return
    }

    this.isRunning = true

    while (this.isRunning) {
      await Promise.all([
        this.checkCodeUpdate(),
        this.checkEnvUpdate(),
        this.checkCharacterUpdate()
      ])
      await new Promise((resolve) => setTimeout(resolve, 10000))
    }
  }

  private async checkEnvUpdate(): Promise<void> {
    // read envvars file
    const envvars = fs.readFileSync(ENV_FILE, 'utf8')
    const checksum = crypto.createHash('md5').update(envvars).digest('hex')
    if (isNull(this.envvarsChecksum) || this.envvarsChecksum === checksum) {
      this.envvarsChecksum = checksum
      return
    }

    // kill the process and docker container should restart it
    elizaLogger.log(`New envvars file detected. Restarting agent...`)
    await this.eventService.publishEnvChangeEvent(envvars)

    if (process.env.NODE_ENV === 'production') {
      process.exit(0)
    }
  }

  private async checkCharacterUpdate(): Promise<void> {
    // read character file
    const character = fs.readFileSync(CHARACTER_FILE, 'utf8')
    const checksum = crypto.createHash('md5').update(character).digest('hex')
    if (isNull(this.characterChecksum) || this.characterChecksum === checksum) {
      this.characterChecksum = checksum
      return
    }

    // kill the process and docker container should restart it
    elizaLogger.log(`New character file detected. Restarting agent...`)
    const characterObject = CharacterSchema.parse(
      JSON.parse(fs.readFileSync(CHARACTER_FILE, 'utf8'))
    )
    await this.eventService.publishCharacterChangeEvent(characterObject)
    if (process.env.NODE_ENV === 'production') {
      process.exit(0)
    }
  }

  private async checkCodeUpdate(): Promise<void> {
    try {
      const git = simpleGit(CODE_DIR)
      const commitHash = (await git.revparse(['HEAD'])).trim()
      const remoteUrl = await git.remote(['get-url', 'origin'])

      if (!isRequiredString(remoteUrl)) {
        elizaLogger.error('No remote url found')
        return
      }

      if (isNull(this.gitCommitHash) || this.gitCommitHash === commitHash) {
        this.gitCommitHash = commitHash
      } else {
        // kill the process and docker container should restart it
        elizaLogger.log(
          `New code detected current=${this.gitCommitHash} new=${commitHash}. Restarting agent...`
        )
        await this.eventService.publishCodeChangeEvent(commitHash.trim(), remoteUrl.trim())
        if (process.env.NODE_ENV === 'production') {
          process.exit(0)
        }
      }
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes('Cannot use simple-git on a directory that does not exist')
      ) {
        elizaLogger.log('Git directory not initiated yet')
      } else {
        elizaLogger.error('Error checking git status:', e)
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false
    elizaLogger.log('Stopping config service...')
  }
}
