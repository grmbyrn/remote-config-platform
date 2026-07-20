import { Router } from "express";
import { requireFirebaseAuth } from "../middleware/requireFirebaseAuth.js";
import { getParametersHandler, postParameterHandler, putParameterHandler, deleteParameterHandler, putOverrideHandler, deleteOverrideHandler } from "../controllers/parametersController.js";

const router = Router()

router.get('/', requireFirebaseAuth, getParametersHandler)
router.post('/', requireFirebaseAuth, postParameterHandler)
router.put('/:key', requireFirebaseAuth, putParameterHandler)
router.delete('/:key', requireFirebaseAuth, deleteParameterHandler)
router.put('/:key/overrides/:country', requireFirebaseAuth, putOverrideHandler)
router.delete('/:key/overrides/:country', requireFirebaseAuth, deleteOverrideHandler)

export default router