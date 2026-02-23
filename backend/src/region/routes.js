import express from 'express';
import { getRegions, getRegionByCode, getRegionsGeoJSON } from './controller.js';

const router = express.Router();

router.get('/', getRegions);
router.get('/geojson', getRegionsGeoJSON);
router.get('/:code', getRegionByCode);

export default router;