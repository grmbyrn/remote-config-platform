import {Router} from 'express'
import {requireApiToken} from '../middleware/requireApiToken.js'
import {getConfigHandler} from '../controllers/configController.js'

const router = Router()
router.get('/', requireApiToken, getConfigHandler)
export default router