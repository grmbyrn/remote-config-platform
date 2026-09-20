import express from 'express'
import cors from 'cors'
import healthRoutes from './routes/health.js'
import healthCheckRoutes from './routes/healthCheck.js'
import parameterRoutes from './routes/parameters.js'
import configRoutes from './routes/config.js'

export function createApp(){
    const app = express()

    app.use(cors({origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}))
    app.use(express.json())

    app.use('/', healthRoutes)
    app.use('/healthcheck', healthCheckRoutes)
    app.use('/parameters', parameterRoutes)
    app.use('/config', configRoutes)

    return app
}
