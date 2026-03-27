import { Router } from 'express'
import { randomUUID } from 'crypto'
import db from '../db.js'

const router = Router()

// POST /api/messages  — recibe un mensaje desde la cola de sincronización
router.post('/', (req, res) => {
  const { roomId, content, author, createdAt } = req.body

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'El campo content es requerido' })
  }

  const message = {
    id: randomUUID(),
    roomId: typeof roomId === 'string' ? roomId.trim() || 'general' : 'general',
    content: content.trim(),
    author: typeof author === 'string' ? author.trim() || 'anónimo' : 'anónimo',
    createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  }

  db.prepare(`
    INSERT INTO messages (id, roomId, content, author, createdAt, receivedAt)
    VALUES (@id, @roomId, @content, @author, @createdAt, @receivedAt)
  `).run(message)

  console.log(`[messages] Nuevo mensaje en sala "${message.roomId}" de "${message.author}"`)
  res.status(201).json({ ...message, synced: true })
})

// GET /api/messages/:roomId?limit=50&before=<createdAt>
router.get('/:roomId', (req, res) => {
  const { roomId } = req.params
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const before = req.query.before

  const messages = before
    ? db.prepare('SELECT * FROM messages WHERE roomId = ? AND createdAt < ? ORDER BY createdAt DESC LIMIT ?').all(roomId, before, limit).reverse()
    : db.prepare('SELECT * FROM messages WHERE roomId = ? ORDER BY createdAt DESC LIMIT ?').all(roomId, limit).reverse()

  res.json(messages)
})

// GET /api/messages?limit=50
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const messages = db.prepare('SELECT * FROM messages ORDER BY createdAt DESC LIMIT ?').all(limit).reverse()
  res.json(messages)
})

export default router
