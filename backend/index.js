import express from 'express'
import healthRoutes from './routes/health.js'
import healthCheckRoutes from './routes/healthCheck.js'
import parameterRoutes from './routes/parameters.js'
import cors from 'cors'
import configRoutes from './routes/config.js'
import {startConfigListener} from './services/config.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}))
app.use(express.json())

// Health checks
app.use('/', healthRoutes)
app.use('/healthcheck', healthCheckRoutes)

app.use('/parameters', parameterRoutes)

app.use('/config', configRoutes)

if(!process.env.API_TOKEN){
    throw new Error('API_TOKEN is not set')
}

await startConfigListener()
app.listen(PORT, () => console.log(`Server listening on Port ${PORT}`))