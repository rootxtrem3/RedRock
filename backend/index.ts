import type { RequestListener } from 'node:http'
import express from 'express'
import { createApp } from './src/app.js'
import { MarsDataStore } from './src/data/marsData.js'

// Keep the direct Express import in this recognized entrypoint. Vercel's
// Express adapter scans entrypoint files for it before loading the handler.
const app = express()
app.use(createApp(new MarsDataStore()))

// Vercel imports this module and needs a callable request handler. Exporting
// the Express app directly is ambiguous because an Express app also exposes
// `listen()`, which some launchers mistake for an `http.Server`. A plain
// request listener takes the function branch in every launcher variant.
// `export =` compiles to `module.exports = handler`, so `import()` resolves to
// the function itself instead of a nested `{ default: handler }`.
const handler: RequestListener = (request, response) => app(request, response)

export = handler
