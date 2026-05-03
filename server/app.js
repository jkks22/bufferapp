import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import messagesRouter from './routes/messages.js'
import demoRouter from './routes/demo.js'
import healthRouter from './routes/health.js'
import { notFound } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/demo', demoRouter)

// En producción sirve el build de Vite y deja que React Router maneje el resto
if (isProd) {
  const distPath = join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')))
} else {
  app.use(notFound)
}

app.use(errorHandler)

export default app
