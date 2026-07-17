import {Router} from 'express'
import { checkFirestore } from '../controllers/healthCheckController.js'

const router = Router()

router.get('/firestore', checkFirestore)

export default router