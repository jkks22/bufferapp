import express from 'express'
import cors from 'cors'
import messagesRouter from './routes/messages.js'
import demoRouter from './routes/demo.js'
import healthRouter from './routes/health.js'
import { notFound } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/demo', demoRouter)

app.use(notFound)
app.use(errorHandler)

export default app
