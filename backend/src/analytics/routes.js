// backend/src/analytics/routes.js

import { Router } from 'express';
import {
    getOverview,
    getIssueAnalytics,
    getInfraAnalytics,
    getCropAnalytics,
    getDistrictScoring,
    getDistrictDetail,
    getRegionSummary,
    getBudgetAnalytics,
    getChoropleth,
    getTrends,
    getResolution,
    getEfficiency,
    getDistrictProfile,
    getTaskAnalytics,
    getProgramAnalytics
} from './controller.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get('/overview', cacheMiddleware(300, 'analytics'), getOverview);
router.get('/issues', cacheMiddleware(300, 'analytics'), getIssueAnalytics);
router.get('/infrastructure', cacheMiddleware(300, 'analytics'), getInfraAnalytics);
router.get('/crops', cacheMiddleware(300, 'analytics'), getCropAnalytics);
router.get('/tasks', cacheMiddleware(120, 'analytics'), getTaskAnalytics);
router.get('/programs', cacheMiddleware(120, 'analytics'), getProgramAnalytics);
router.get('/districts/scoring', cacheMiddleware(300, 'analytics'), getDistrictScoring);
router.get('/districts/:id', cacheMiddleware(120, 'analytics'), getDistrictDetail);
router.get('/regions/summary', cacheMiddleware(300, 'analytics'), getRegionSummary);
router.get('/budget', cacheMiddleware(300, 'analytics'), getBudgetAnalytics);
router.get('/choropleth', cacheMiddleware(600, 'analytics'), getChoropleth);
router.get('/trends', cacheMiddleware(300, 'analytics'), getTrends);
router.get('/resolution', cacheMiddleware(300, 'analytics'), getResolution);
router.get('/efficiency', cacheMiddleware(300, 'analytics'), getEfficiency);
router.get('/district/:name', cacheMiddleware(120, 'analytics'), getDistrictProfile);

export default router;