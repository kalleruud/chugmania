import express from 'express'
import { Server } from 'socket.io'
import ViteExpress from 'vite-express'
import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
} from '../../common/utils/constants'
import ConnectionManager from './managers/connection.manager'
import DocsManager from './managers/docs.manager'

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 6996
const app = express()

app.get('/api/docs', (_req, res) => {
  try {
    const docs = DocsManager.listDocs()
    res.json({ success: true, docs })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list documents'
    res.status(500).json({ success: false, message })
  }
})

app.get('/api/docs/:slug', async (req, res) => {
  try {
    const doc = await DocsManager.getDoc(req.params.slug)
    res.json({ success: true, doc })
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Document not found'
        ? 404
        : 500
    const message =
      error instanceof Error ? error.message : 'Failed to load document'
    res.status(status).json({ success: false, message })
  }
})

const server = ViteExpress.listen(app, PORT)
const io = new Server(server, {
  cors: {
    origin: [process.env.ORIGIN ?? 'http://localhost:' + PORT],
    credentials: true,
  },
})

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)
