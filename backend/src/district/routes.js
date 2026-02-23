import express from 'express';
import { getDistricts, getDistrictById, getDistrictsGeoJSON, lookupDistrict } from './controller.js';

const router = express.Router();

router.get('/', getDistricts);
router.get('/geojson', getDistrictsGeoJSON);
router.get('/lookup', lookupDistrict);
router.get('/:id', getDistrictById);

export default router;