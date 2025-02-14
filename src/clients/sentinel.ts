import { AGENT_SENTINEL_DIR } from '@/common/constants'
import axios from 'axios'
import os from 'os'
import path from 'path'

export const sentinelClient = axios.create({
  socketPath: path.join(os.homedir(), AGENT_SENTINEL_DIR, 'sentinel.sock'),
  baseURL: 'http://unix',
  headers: {
    'Content-Type': 'application/json'
  }
})
