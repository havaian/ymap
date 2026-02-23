import { Router } from 'express';
import { getOrgScoring, getOrgDetail, getDeficitIndex } from './controller.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// Org scoring is expensive — cache 5 min
router.get('/scoring', cacheMiddleware(300, 'analytics'), getOrgScoring);
router.get('/deficit', cacheMiddleware(300, 'analytics'), getDeficitIndex);
router.get('/org/:id', cacheMiddleware(120, 'analytics'), getOrgDetail);

export default router;