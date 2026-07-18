import { Router } from "express";
import { requireFirebaseAuth } from "../middleware/requireFirebaseAuth.js";
import { getParameters, postParameter, putParameter } from "../controllers/parametersController.js";

const router = Router()

router.get('/', requireFirebaseAuth, getParameters)
router.post('/', requireFirebaseAuth, postParameter)
router.put('/:key', requireFirebaseAuth, putParameter)

export default router