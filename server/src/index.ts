import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN ?? '*' },
})

app.get('/health', (_req, res) => res.json({ ok: true }))

io.on('connection', (socket) => {
  console.log('connected', socket.id)
  socket.on('disconnect', () => console.log('disconnected', socket.id))
})

const PORT = Number(process.env.PORT ?? 3001)
httpServer.listen(PORT, () => console.log(`server on :${PORT}`))
