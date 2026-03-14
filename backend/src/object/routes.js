// backend/src/object/routes.js

import { Router } from 'express';
import { getObjects, getObject } from './controller.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// Public read — citizens and admins browse objects
router.get('/', cacheMiddleware(120, 'objects'), getObjects);
router.get('/:id', cacheMiddleware(60, 'objects'), getObject);

export default router;