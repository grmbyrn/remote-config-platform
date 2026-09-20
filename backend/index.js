import {createApp} from './app.js'
import {startConfigListener} from './services/config.js'

const PORT = process.env.PORT || 3000

if(!process.env.API_TOKEN){
    throw new Error('API_TOKEN is not set')
}

await startConfigListener()
createApp().listen(PORT, () => console.log(`Server listening on Port ${PORT}`))
