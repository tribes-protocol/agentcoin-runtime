import { AGENTCOIN_FUN_API_URL } from '@/common/env'
import { serializeIdentity } from '@/common/functions'
import { ErrorResponseSchema, Identity, User, UserSchema } from '@/common/types'

// FIXME: hish - we already have `user_api.ts`. Move that stuff here once Aditya/Nick changes land

class AgentcoinAPI {
  // Get user by identity
  async getUser(identity: Identity): Promise<User> {
    const response = await fetch(`${AGENTCOIN_FUN_API_URL}/api/user/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: serializeIdentity(identity) })
    })

    if (response.status !== 200) {
      const error = await response.json()
      const parsed = ErrorResponseSchema.parse(error)
      throw new Error(parsed.error)
    }

    const data = await response.json()
    const parsed = UserSchema.parse(data)
    return parsed
  }
}

const agentcoinAPI = new AgentcoinAPI()

export { agentcoinAPI }
