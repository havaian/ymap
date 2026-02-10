import express from 'express';
import { 
    getInfrastructure, 
    getInfrastructureById, 
    getNearbyInfrastructure 
} from './controller.js';

const router = express.Router();

// Get all infrastructure (with optional filters)
router.get('/', getInfrastructure);

// Get nearby infrastructure
router.get('/nearby', getNearbyInfrastructure);

// Get infrastructure by ID
router.get('/:id', getInfrastructureById);

export default router;