import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// En producción (contenedor) se usa /app/server/data/data.sqlite (volumen montado)
// En desarrollo se usa server/data.sqlite junto al código
const dbDir = process.env.DB_PATH || join(__dirname, 'data.sqlite')
const db = new Database(dbDir)

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
