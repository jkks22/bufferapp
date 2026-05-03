// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createRequire } from 'module'

// Create an in-memory SQLite database to use as the mock
const require = createRequire(import.meta.url)

const inMemoryDb = (() => {
  const Database = require('better-sqlite3')
  const db = new Database(':memory:')
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
  return db
})()

vi.mock('../../../server/db.js', () => ({ default: inMemoryDb }))

let server
let baseUrl

beforeAll(async () => {
  const mod = await import('../../../server/app.js')
  const app = mod.default
  await new Promise(resolve => {
    server = app.listen(0, () => {
      const { port } = server.address()
      baseUrl = `http://localhost:${port}`
      resolve()
    })
  })
})

afterAll(() => {
  server?.close()
  inMemoryDb.exec('DELETE FROM messages')
})

// ─────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────

describe('GET /api/health', () => {
  it('devuelve status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('incluye uptime y timestamp', async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    const body = await res.json()
    expect(typeof body.uptime).toBe('number')
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })
})

// ─────────────────────────────────────────────
// POST /api/messages
// ─────────────────────────────────────────────

describe('POST /api/messages', () => {
  it('crea un mensaje correctamente', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'general', content: 'Hola test', author: 'Tester', createdAt: new Date().toISOString() }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.content).toBe('Hola test')
    expect(body.author).toBe('Tester')
    expect(body.roomId).toBe('general')
    expect(body.id).toBeTruthy()
    expect(body.synced).toBe(true)
  })

  it('asigna roomId "general" por defecto', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Sin sala' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.roomId).toBe('general')
  })

  it('asigna author "anónimo" por defecto', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Sin autor' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.author).toBe('anónimo')
  })

  it('rechaza 400 si content está vacío', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '   ', author: 'Alguien' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('rechaza 400 si content está ausente', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'Alguien' }),
    })
    expect(res.status).toBe(400)
  })

  it('genera un UUID único por mensaje', async () => {
    const send = () => fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Mensaje único' }),
    }).then(r => r.json())

    const [a, b] = await Promise.all([send(), send()])
    expect(a.id).not.toBe(b.id)
  })
})

// ─────────────────────────────────────────────
// GET /api/messages/:roomId
// ─────────────────────────────────────────────

describe('GET /api/messages/:roomId', () => {
  it('responde con array JSON', async () => {
    const res = await fetch(`${baseUrl}/api/messages/general`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('incluye mensajes del roomId correcto', async () => {
    // Insert a known message directly
    inMemoryDb.prepare(`
      INSERT INTO messages (id, roomId, content, author, createdAt, receivedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('test-id-1', 'sala-x', 'Mensaje sala X', 'Tester', new Date().toISOString(), new Date().toISOString())

    const res = await fetch(`${baseUrl}/api/messages/sala-x`)
    const body = await res.json()
    expect(body.some(m => m.content === 'Mensaje sala X')).toBe(true)
  })

  it('acepta parámetro limit', async () => {
    const res = await fetch(`${baseUrl}/api/messages/general?limit=5`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.length).toBeLessThanOrEqual(5)
  })
})

// ─────────────────────────────────────────────
// GET /api/messages
// ─────────────────────────────────────────────

describe('GET /api/messages', () => {
  it('devuelve todos los mensajes como array', async () => {
    const res = await fetch(`${baseUrl}/api/messages`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})

// ─────────────────────────────────────────────
// POST /api/demo
// ─────────────────────────────────────────────

describe('POST /api/demo', () => {
  it('responde con received: true', async () => {
    const res = await fetch(`${baseUrl}/api/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Item de prueba', ts: Date.now() }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })

  it('devuelve el mensaje y ts en el body de respuesta', async () => {
    const res = await fetch(`${baseUrl}/api/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hola demo', ts: 12345 }),
    })
    const body = await res.json()
    expect(body.message).toBe('hola demo')
    expect(body.ts).toBe(12345)
  })
})

// ─────────────────────────────────────────────
// Rutas no existentes
// ─────────────────────────────────────────────

describe('Rutas no existentes', () => {
  it('devuelve 404 para rutas desconocidas', async () => {
    const res = await fetch(`${baseUrl}/api/no-existe`)
    expect(res.status).toBe(404)
  })
})
