import { POSTGRES_URL } from '@/common/env'
import { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres'
import { IDatabaseAdapter, IDatabaseCacheAdapter } from '@elizaos/core'

export async function initializeDatabase(): Promise<IDatabaseAdapter & IDatabaseCacheAdapter> {
  const db = new PostgresDatabaseAdapter({
    connectionString: POSTGRES_URL
  })
  await db.init()
  return db
}
