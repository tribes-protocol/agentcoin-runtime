import { CODE_DIR } from '@/common/constants'
import { isNull } from '@/common/functions'
import { elizaLogger } from '@elizaos/core'
import simpleGit from 'simple-git'

export class CodeService {
  private isRunning = false
  private commitHash: string | undefined

  // constructor() {}

  async start(): Promise<void> {
    // disable in dev mode
    if (process.env.NODE_ENV !== 'production') {
      elizaLogger.log('Code service disabled in dev mode')
      return
    }

    if (this.isRunning) {
      return
    }

    this.isRunning = true

    while (this.isRunning) {
      try {
        const git = simpleGit(CODE_DIR)
        const commitHash = await git.revparse(['HEAD'])

        if (isNull(commitHash) || this.commitHash === commitHash) {
          this.commitHash = commitHash
        } else {
          // kill the process and docker container should restart it
          elizaLogger.log(`New code detected ${commitHash}. Restarting agent...`)
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
      } finally {
        // Sleep for 30 seconds
        await new Promise((resolve) => setTimeout(resolve, 30000))
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false
  }
}
