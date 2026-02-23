import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export interface OverviewData {
    counts: { organizations: number; infrastructure: number; issues: number; regions: number; districts: number };
    issues: { byStatus: Record<string, number>; bySeverity: Record<string, number>; resolutionRate: number };
    budget: { committedUZS: number; spentUZS: number; committedUSD: number; spentUSD: number; executionRate: number };
}

export interface DistrictScore {
    districtId: string;
    districtName: { en: string; ru: string; uz: string };
    regionCode: number;
    areaKm2: number;
    centroid?: [number, number];
    rank: number;
    issueCount: number;
    openCount: number;
    resolvedCount: number;
    criticalCount: number;
    highCount: number;
    resolutionRate: number;
    issueDensity: number;
    totalVotes: number;
    orgCount: number;
    schoolCount: number;
    hospitalCount: number;
    infraCount: number;
    roadCount: number;
    waterCount: number;
    facilityDensity: number;
    budgetCommittedUZS: number;
    budgetSpentUZS: number;
    budgetExecution: number;
    cropDiversity: number;
    scores: { infrastructure: number; issues: number; budget: number; crops: number; composite: number };
}

export interface RegionSummary {
    regionCode: number;
    regionName: { en: string; ru: string; uz: string };
    areaKm2: number;
    issueCount: number;
    openCount: number;
    resolvedCount: number;
    resolutionRate: number;
    issueDensity: number;
    totalVotes: number;
    orgCount: number;
    infraCount: number;
    budgetCommittedUZS: number;
    budgetSpentUZS: number;
}

export interface IssueAnalytics {
    total: number;
    density: number | null;
    byCategory: { _id: string; count: number; avgVotes: number }[];
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    byDistrict: any[];
    trends: { year: number; month: number; count: number; resolved: number }[];
    topVoted: any[];
}

export interface CropAnalytics {
    cropTotals: { _id: number; name: string; color: string; districtCount: number }[];
    byDistrict: any[];
}

export const useAnalytics = () => {
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [districtScoring, setDistrictScoring] = useState<DistrictScore[]>([]);
    const [regionSummary, setRegionSummary] = useState<RegionSummary[]>([]);
    const [issueAnalytics, setIssueAnalytics] = useState<IssueAnalytics | null>(null);
    const [cropAnalytics, setCropAnalytics] = useState<CropAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async (regionCode?: number) => {
        try {
            setLoading(true);
            setError(null);

            const params = regionCode ? { regionCode } : {};

            const [overviewRes, scoringRes, regionsRes, issuesRes, cropsRes] = await Promise.all([
                api.get('/analytics/overview'),
                api.get('/analytics/districts/scoring', { params }),
                api.get('/analytics/regions/summary'),
                api.get('/analytics/issues', { params }),
                api.get('/analytics/crops', { params })
            ]);

            setOverview(overviewRes.data.data);
            setDistrictScoring(scoringRes.data.data.districts);
            setRegionSummary(regionsRes.data.data);
            setIssueAnalytics(issuesRes.data.data);
            setCropAnalytics(cropsRes.data.data);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to fetch analytics');
            console.error('Analytics fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    return {
        overview,
        districtScoring,
        regionSummary,
        issueAnalytics,
        cropAnalytics,
        loading,
        error,
        refetch: fetchAll
    };
};