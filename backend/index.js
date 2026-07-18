import express from 'express'
import healthRoutes from './routes/health.js'
import healthCheckRoutes from './routes/healthCheck.js'
import parameterRoutes from './routes/parameters.js'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({origin: 'http://localhost:5173'}))
app.use(express.json())

// Health checks
app.use('/', healthRoutes)
app.use('/healthcheck', healthCheckRoutes)

app.use('/parameters', parameterRoutes)

app.listen(PORT, () => console.log(`Server listening on Port ${PORT}`))