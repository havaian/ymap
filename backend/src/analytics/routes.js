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
    getOvercrowdedFacilities,
    getProblematicFacilities
} from './controller.js';
import { getDeprivation, getDeprivationChoropleth } from './deprivation.js';
import { getDataQuality } from './data-quality.js';
import { getChanges, getChangeTimeline } from './changes.js';
import { getVerificationQueue, getVerificationQueueAudit } from './verification-queue.js';
import { getCapacity } from './capacity.js';
import { getWear } from './wear.js';
import { getComposite } from './composite.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get('/overview', cacheMiddleware(300, 'analytics'), getOverview);
router.get('/issues', cacheMiddleware(300, 'analytics'), getIssueAnalytics);
router.get('/infrastructure', cacheMiddleware(300, 'analytics'), getInfraAnalytics);
router.get('/crops', cacheMiddleware(300, 'analytics'), getCropAnalytics);
router.get('/districts/scoring', cacheMiddleware(300, 'analytics'), getDistrictScoring);
router.get('/districts/:id', cacheMiddleware(120, 'analytics'), getDistrictDetail);
router.get('/regions/summary', cacheMiddleware(300, 'analytics'), getRegionSummary);
router.get('/budget', cacheMiddleware(300, 'analytics'), getBudgetAnalytics);
router.get('/choropleth', cacheMiddleware(600, 'analytics'), getChoropleth);
router.get('/trends', cacheMiddleware(300, 'analytics'), getTrends);
router.get('/resolution', cacheMiddleware(300, 'analytics'), getResolution);
router.get('/efficiency', cacheMiddleware(300, 'analytics'), getEfficiency);
router.get('/district/:name', cacheMiddleware(120, 'analytics'), getDistrictProfile);
router.get('/overcrowded', cacheMiddleware(300, 'analytics'), getOvercrowdedFacilities);
router.get('/problematic-facilities', cacheMiddleware(180, 'analytics'), getProblematicFacilities);

// Both read the objects collection and change only when an import runs, so they
// cache long. Query parameters are part of the cache key.
router.get('/deprivation/choropleth', cacheMiddleware(900, 'analytics'), getDeprivationChoropleth);
router.get('/deprivation', cacheMiddleware(900, 'analytics'), getDeprivation);
router.get('/data-quality', cacheMiddleware(900, 'analytics'), getDataQuality);

// The change log moves only when diff-snapshots.js runs, which is rare by nature.
router.get('/changes/timeline', cacheMiddleware(900, 'analytics'), getChangeTimeline);
router.get('/changes', cacheMiddleware(900, 'analytics'), getChanges);

// Deliberately not cached. A cached queue would hand the same random draw to every
// caller, which is the same as having no random arm. The audit is cheap and also
// left uncached so it reflects what was just served.
router.get('/verification-queue/audit', getVerificationQueueAudit);
router.get('/verification-queue', getVerificationQueue);

// A thousand perturbation runs over every district, so it is the most expensive
// read in the API. It also moves only when an import runs, which is what makes a
// long cache correct rather than merely convenient. Query parameters, including
// the weights and the seed, are part of the cache key.
router.get('/composite', cacheMiddleware(900, 'analytics'), getComposite);

router.get('/capacity', cacheMiddleware(900, 'analytics'), getCapacity);
router.get('/wear', cacheMiddleware(900, 'analytics'), getWear);

export default router;