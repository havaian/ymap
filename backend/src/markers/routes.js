import { Router } from 'express';
import { getOrgMarkers, getInfraMarkers, getIssueMarkers } from './controller.js';

const router = Router();

router.get('/organizations', getOrgMarkers);
router.get('/infrastructure', getInfraMarkers);
router.get('/issues', getIssueMarkers);

export default router;