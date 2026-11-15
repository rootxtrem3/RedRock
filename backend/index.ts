import { createApp } from './src/app.js'
import { MarsDataStore } from './src/data/marsData.js'

// Vercel serves this Express app as a serverless function.
const app = createApp(new MarsDataStore())

export default app
