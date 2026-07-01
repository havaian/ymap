// backend/src/markers/routes.js

import { Router } from 'express';
import { getObjectMarkers, getIssueMarkers } from './controller.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get('/objects', cacheMiddleware(3600, 'markers'), getObjectMarkers); // 1 час
// Этап 10: слой issues на карте убран (обращения идут лентой, не отдельным слоем). Роут закомментирован.
// router.get('/issues', cacheMiddleware(60, 'markers'), getIssueMarkers);

export default router;