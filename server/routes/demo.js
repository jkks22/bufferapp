import { Router } from 'express'

const router = Router()

// POST /api/demo  — endpoint de prueba para QueuePage en modo dev
router.post('/', (req, res) => {
  const { message, ts } = req.body
  console.log(`[demo] Petición recibida: "${message}" (ts: ${ts})`)
  res.json({ received: true, message, ts })
})

export default router
