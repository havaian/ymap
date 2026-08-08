// backend/src/object/routes.js

import { Router } from 'express';
import { getObjects, getObject } from './controller.js';
import { getObjectProfile } from './profile.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// Public read - citizens and admins browse objects
router.get('/', cacheMiddleware(120, 'objects'), getObjects);
router.get('/:id', cacheMiddleware(60, 'objects'), getObject);

// The facility card. Cached longer than the plain record because everything in
// it moves only when an import or a snapshot diff runs, and it is the most
// expensive read in this router: the dimension decomposition plus the change log.
// Mounted after /:id so the bare id route keeps its own shape.
router.get('/:id/profile', cacheMiddleware(300, 'objects'), getObjectProfile);

export default router;