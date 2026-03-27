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

// GET /api/messages/:roomId  — lista mensajes de una sala
router.get('/:roomId', (req, res) => {
  const { roomId } = req.params
  const messages = db.prepare('SELECT * FROM messages WHERE roomId = ? ORDER BY createdAt ASC').all(roomId)
  res.json(messages)
})

// GET /api/messages  — lista todos los mensajes
router.get('/', (_req, res) => {
  const messages = db.prepare('SELECT * FROM messages ORDER BY createdAt ASC').all()
  res.json(messages)
})

export default router
