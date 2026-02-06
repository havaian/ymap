import express from 'express';
import { getOrganizations, getOrganization, getNearbyOrganizations } from './controller.js';

const router = express.Router();

router.get('/', getOrganizations);
router.get('/nearby', getNearbyOrganizations);
router.get('/:id', getOrganization);

export default router;