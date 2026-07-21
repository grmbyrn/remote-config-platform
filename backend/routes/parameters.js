import { Router } from "express";
import { requireFirebaseAuth } from "../middleware/requireFirebaseAuth.js";
import { getParametersHandler, postParameterHandler, putParameterHandler, deleteParameterHandler, putOverrideHandler, deleteOverrideHandler, postSuggestionsHandler, approveSuggestionHandler, rejectSuggestionHandler } from "../controllers/parametersController.js";

const router = Router()

router.get('/', requireFirebaseAuth, getParametersHandler)
router.post('/', requireFirebaseAuth, postParameterHandler)
router.put('/:key', requireFirebaseAuth, putParameterHandler)
router.delete('/:key', requireFirebaseAuth, deleteParameterHandler)
router.put('/:key/overrides/:country', requireFirebaseAuth, putOverrideHandler)
router.delete('/:key/overrides/:country', requireFirebaseAuth, deleteOverrideHandler)
router.post('/:key/suggestions', requireFirebaseAuth, postSuggestionsHandler)
router.post('/:key/suggestions/:country/approve', requireFirebaseAuth, approveSuggestionHandler)
router.delete('/:key/suggestions/:country', requireFirebaseAuth, rejectSuggestionHandler)

export default router