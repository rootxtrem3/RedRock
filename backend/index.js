// Vercel loads this file as the service entrypoint and requires its CommonJS
// export to be a callable request handler or a server. It is plain JavaScript
// on purpose: TypeScript entrypoints are transpiled by the platform at deploy
// time, and that transform did not preserve `export default` / `export =`
// through to the deployed module.
const express = require('express')
const { createApp } = require('./dist/createApp.js')
const { MarsDataStore } = require('./dist/data/marsData.js')

const app = express()
app.use(createApp(new MarsDataStore()))

const handler = (request, response) => app(request, response)
// Expose the same function as `default` so launchers that unwrap ESM-style
// default exports resolve it, while `module.exports` stays callable.
handler.default = handler
module.exports = handler

console.log('[red-rock-api] root entry initialized')
