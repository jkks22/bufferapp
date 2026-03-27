import { Router } from 'express'
import { randomUUID } from 'crypto'

const router = Router()

// Almacenamiento en memoria (dev). Para producción reemplazar con una DB real.
const messages = []

// POST /api/messages  — recibe un mensaje desde la cola de sincronización
router.post('/', (req, res) => {
  const { roomId, content, author, createdAt } = req.body

  if (!content) {
    return res.status(400).json({ error: 'El campo content es requerido' })
  }

  const message = {
    id: randomUUID(),
    roomId: roomId || 'general',
    content,
    author: author || 'anónimo',
    createdAt: createdAt || new Date().toISOString(),
    synced: true,
    receivedAt: new Date().toISOString(),
  }

  messages.push(message)
  console.log(`[messages] Nuevo mensaje en sala "${message.roomId}" de "${message.author}"`)
  res.status(201).json(message)
})

// GET /api/messages/:roomId  — lista mensajes de una sala
router.get('/:roomId', (req, res) => {
  const { roomId } = req.params
  const roomMessages = messages.filter(m => m.roomId === roomId)
  res.json(roomMessages)
})

// GET /api/messages  — lista todos los mensajes
router.get('/', (_req, res) => {
  res.json(messages)
})

export default router
