import express from 'express';
import { getInfrastructure, getInfrastructureItem, getNearbyInfrastructure } from './controller.js';

const router = express.Router();

router.get('/', getInfrastructure);
router.get('/nearby', getNearbyInfrastructure);
router.get('/:id', getInfrastructureItem);

export default router;