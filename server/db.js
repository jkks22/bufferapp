import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, 'data.sqlite'))

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    roomId TEXT NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'anónimo',
    createdAt TEXT NOT NULL,
    receivedAt TEXT NOT NULL
  )
`)

export default db
