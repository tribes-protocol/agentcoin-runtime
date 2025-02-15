import { CODE_DIR } from '@/common/constants'
import { isNull } from '@/common/functions'
import { elizaLogger } from '@elizaos/core'
import simpleGit from 'simple-git'

export class CodeService {
  private isRunning = false
  private readonly git = simpleGit(CODE_DIR)
  private commitHash: string | undefined

  // constructor() {}

  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    while (this.isRunning) {
      const commitHash = await this.git.revparse(['HEAD'])

      if (isNull(commitHash) || this.commitHash === commitHash) {
        this.commitHash = commitHash
      } else {
        // kill the process and docker container should restart it
        elizaLogger.log(`New code detected ${commitHash}. Restarting agent...`)
        if (process.env.NODE_ENV === 'production') {
          process.exit(0)
        }
      }

      // Sleep for 30 seconds
      await new Promise((resolve) => setTimeout(resolve, 30000))
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false
  }
}
