import { Router } from "express";
import { requireFirebaseAuth } from "../middleware/requireFirebaseAuth.js";
import { getParametersHandler, postParameterHandler, putParameterHandler, deleteParameterHandler } from "../controllers/parametersController.js";

const router = Router()

router.get('/', requireFirebaseAuth, getParametersHandler)
router.post('/', requireFirebaseAuth, postParameterHandler)
router.put('/:key', requireFirebaseAuth, putParameterHandler)
router.delete('/:key', requireFirebaseAuth, deleteParameterHandler)

export default router