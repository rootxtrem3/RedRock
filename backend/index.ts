import express from 'express'
import { createApp } from './src/app.js'
import { MarsDataStore } from './src/data/marsData.js'

// Keep the direct Express import in this recognized entrypoint. Vercel's
// Express adapter scans entrypoint files for it before loading the handler.
const app = express()
app.use(createApp(new MarsDataStore()))

// Vercel's function runtime imports this file and requires the module's
// default export to be the handler. `export =` compiles to
// `module.exports = app`, so both `require()` and `import()` see the Express
// app directly; `export default` would produce a nested `{ default: app }`.
export = app
