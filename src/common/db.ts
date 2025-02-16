import { SQLITE_FILE } from '@/common/constants'
import { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres'
import { SqliteDatabaseAdapter } from '@elizaos/adapter-sqlite'
import { IDatabaseAdapter, IDatabaseCacheAdapter } from '@elizaos/core'
import Database from 'better-sqlite3'

export function initializeDatabase(): IDatabaseAdapter & IDatabaseCacheAdapter {
  if (process.env.POSTGRES_URL) {
    const db = new PostgresDatabaseAdapter({
      connectionString: process.env.POSTGRES_URL
    })
    return db
  } else {
    const db = new SqliteDatabaseAdapter(new Database(SQLITE_FILE))
    return db
  }
}
