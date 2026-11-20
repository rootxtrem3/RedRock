import express from 'express'
import { createApp } from './createApp.js'
import { MarsDataStore } from './data/marsData.js'

// Vercel's Express entrypoint search checks `dist/` first when the project has
// an Output Directory configured. Keeping a valid entrypoint here means the
// build still resolves to a module that exports the app, instead of the
// compiled `createApp` factory. `export =` emits `module.exports = app`.
const app = express()
app.use(createApp(new MarsDataStore()))

console.log('[red-rock-api] dist entry initialized')

export = app
