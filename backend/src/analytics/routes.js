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
    getChoropleth
} from './controller.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

// Cache TTLs: overview/scoring are expensive aggregations — cache 5 min
// Choropleth is very heavy — cache 10 min
router.get('/overview', cacheMiddleware(300, 'analytics'), getOverview);
router.get('/issues', cacheMiddleware(300, 'analytics'), getIssueAnalytics);
router.get('/infrastructure', cacheMiddleware(300, 'analytics'), getInfraAnalytics);
router.get('/crops', cacheMiddleware(300, 'analytics'), getCropAnalytics);
router.get('/districts/scoring', cacheMiddleware(300, 'analytics'), getDistrictScoring);
router.get('/districts/:id', cacheMiddleware(120, 'analytics'), getDistrictDetail);
router.get('/regions/summary', cacheMiddleware(300, 'analytics'), getRegionSummary);
router.get('/budget', cacheMiddleware(300, 'analytics'), getBudgetAnalytics);
router.get('/choropleth', cacheMiddleware(600, 'analytics'), getChoropleth);

export default router;