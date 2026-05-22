import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import messagesRouter from './routes/messages.js'
import demoRouter from './routes/demo.js'
import healthRouter from './routes/health.js'
import proxyRouter from './routes/proxy.js'
import { notFound } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const app = express()

// Seguridad: cabeceras HTTP
app.use(helmet({
  contentSecurityPolicy: isProd ? undefined : false,
  crossOriginEmbedderPolicy: false,
}))

// Compresión gzip para respuestas
app.use(compression())

// CORS: solo el origen configurado en producción, abierto en desarrollo
const corsOrigin = process.env.CORS_ORIGIN
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined))

app.use(express.json())

// Rate limiting: máximo 100 peticiones por IP por 15 minutos en rutas /api
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo más tarde.' },
})

// Rate limiting más estricto para POST de mensajes (anti-spam)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados mensajes. Inténtalo en un minuto.' },
})

app.use('/api', apiLimiter)
app.use('/api/messages', messageLimiter)

app.use('/api/health', healthRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/demo', demoRouter)
app.use('/api/proxy', proxyRouter)

if (isProd) {
  const distPath = join(__dirname, '../dist')
  app.use(express.static(distPath))
  // Express 5 requiere wildcard nombrado en lugar de '*'
  app.get('/{*splat}', (_req, res) => res.sendFile(join(distPath, 'index.html')))
} else {
  app.use(notFound)
}

app.use(errorHandler)

export default app
