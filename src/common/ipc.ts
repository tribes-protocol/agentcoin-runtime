import { randomUUID } from 'crypto'
import { IpcResponseSchema } from '@/common/types'
import { z } from 'zod'

interface BridgeCompleter {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

export class IpcBridge {
  private completers: Map<string, BridgeCompleter> = new Map()

  constructor() {
    this.setupMessageHandling()
  }

  private setupMessageHandling(): void {
    process.on('message', (message: unknown) => {
      const { requestId, data, error } = IpcResponseSchema.parse(message)

      const completer = this.completers.get(requestId)
      if (completer) {
        if (error) {
          completer.reject(new Error(error))
        } else {
          completer.resolve(data)
        }
        this.completers.delete(requestId)
      }
    })
  }

  public async callService<T extends z.ZodType>(
    serviceName: string,
    methodName: string,
    schema: T,
    ...args: unknown[]
  ): Promise<z.infer<T>> {
    const requestId = randomUUID()

    return new Promise((resolve, reject) => {
      this.completers.set(requestId, {
        resolve: (value) => {
          try {
            resolve(schema.parse(value))
          } catch (error) {
            reject(new Error(`Failed to parse response data: ${error}`))
          }
        },
        reject
      })

      process.send({
        requestId,
        serviceName,
        methodName,
        args
      })
    })
  }
}

export const ipc = new IpcBridge()
