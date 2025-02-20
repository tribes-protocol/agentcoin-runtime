import { POSTGRES_URL } from '@/common/env'
import { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres'
import { IDatabaseAdapter, IDatabaseCacheAdapter } from '@elizaos/core'

export function initializeDatabase(): IDatabaseAdapter & IDatabaseCacheAdapter {
  const db = new PostgresDatabaseAdapter({
    connectionString: POSTGRES_URL
  })
  return db
}
