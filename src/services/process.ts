import { isNull } from '@/common/functions'
import { elizaLogger } from '@elizaos/core'

export class ProcessService {
  private shutdownFunc?: (signal?: string) => Promise<void>

  setShutdownFunc(func: (signal?: string) => Promise<void>): void {
    this.shutdownFunc = func
  }

  async kill(): Promise<void> {
    if (isNull(this.shutdownFunc)) {
      console.log('No shutdown function set. killing process...')
      elizaLogger.warn('No shutdown function set. killing process...')
      process.kill(process.pid, 'SIGTERM')
    }
    await this.shutdownFunc()
  }
}
