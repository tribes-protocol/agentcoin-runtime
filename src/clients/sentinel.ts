import axios from 'axios'

export const sentinelClient = axios.create({
  socketPath: '/var/run/sentinel.sock',
  baseURL: 'http://unix',
  headers: {
    'Content-Type': 'application/json'
  }
})
