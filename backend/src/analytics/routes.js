import { Router } from 'express';
import {
    getOverview,
    getIssueAnalytics,
    getInfraAnalytics,
    getCropAnalytics,
    getDistrictScoring,
    getDistrictDetail,
    getRegionSummary
} from './controller.js';

const router = Router();

router.get('/overview', getOverview);
router.get('/issues', getIssueAnalytics);
router.get('/infrastructure', getInfraAnalytics);
router.get('/crops', getCropAnalytics);
router.get('/districts/scoring', getDistrictScoring);
router.get('/districts/:id', getDistrictDetail);
router.get('/regions/summary', getRegionSummary);

export default router;