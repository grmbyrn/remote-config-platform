import express from 'express'
import healthRoutes from './routes/health.js'
import healthCheckRoutes from './routes/healthCheck.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

// Health checks
app.use('/', healthRoutes)
app.use('/healthcheck', healthCheckRoutes)

app.listen(PORT, () => console.log(`Server listening on Port ${PORT}`))