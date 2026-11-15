import { createApp } from './app.js'
import { MarsDataStore } from './data/marsData.js'

const host = process.env.RED_ROCK_HOST ?? '127.0.0.1'
const port = Number(process.env.RED_ROCK_PORT ?? 8000)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('RED_ROCK_PORT must be a valid TCP port')

const store = new MarsDataStore()
const app = createApp(store)
const server = app.listen(port, host, () => {
  console.log(`RED ROCK API listening at http://${host}:${port}`)
  console.log('Endpoints: /api/health /api/capabilities /api/manifest /api/layers /api/sites /api/sample /api/solar /api/profile /api/ice-prospects /api/route')
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
