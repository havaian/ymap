import { Router } from 'express';
import { getOrgMarkers, getInfraMarkers, getIssueMarkers } from './controller.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// Markers are lightweight but hit DB on every page load — cache 2 min
router.get('/organizations', cacheMiddleware(120, 'markers'), getOrgMarkers);
router.get('/infrastructure', cacheMiddleware(120, 'markers'), getInfraMarkers);
router.get('/issues', cacheMiddleware(60, 'markers'), getIssueMarkers);

export default router;