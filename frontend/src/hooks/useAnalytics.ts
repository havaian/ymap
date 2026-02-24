import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Existing types ──────────────────────────────────────

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

export interface BudgetAnalytics {
    totals: {
        committedUZS: number;
        spentUZS: number;
        executionRate: number;
        costPerResolved: number | null;
    };
    byDistrict: Array<{
        districtId: string;
        districtName: { en: string; ru: string; uz: string };
        totalCommittedUZS: number;
        totalSpentUZS: number;
        executionRate: number;
        resolvedCount: number;
        costPerResolved: number | null;
        budgetPerKm2: number;
    }>;
}

// ── New types (trends, resolution, efficiency, district profile) ────────

export interface TrendPoint {
    label: string;
    year: number;
    month: number;
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    resolutionRate: number;
    avgResolutionDays: number | null;
    totalVotes: number;
    severity: Record<string, number>;
}

export interface TrendCategoryStat {
    category: string;
    total: number;
    resolved: number;
    resolutionRate: number;
    avgResolutionDays: number | null;
    totalVotes: number;
}

export interface TrendsData {
    period: { months: number; from: string };
    summary: {
        totalIssues: number;
        totalResolved: number;
        overallResolutionRate: number;
        avgResolutionDays: number | null;
        totalVotes: number;
    };
    trend: TrendPoint[];
    categories: TrendCategoryStat[];
}

export interface ResolutionData {
    overall: { count: number; avgDays: number | null; medianDays: number | null };
    byCategory: Array<{ category: string; count: number; avgDays: number | null; minDays: number | null; maxDays: number | null }>;
    bySeverity: Array<{ severity: string; count: number; avgDays: number | null }>;
    byDistrict: Array<{ district: string; count: number; avgDays: number | null }>;
}

export interface EfficiencyOrg {
    id: string;
    name: string;
    type: string;
    region: string;
    budget: { committed: number; spent: number; executionRate: number };
    issues: { total: number; resolved: number; open: number; votes: number; resolutionRate: number; avgResolutionDays: number | null };
    costPerResolved: number | null;
    inefficiencyScore: number;
}

export interface EfficiencyDistrict {
    district: string;
    totalBudget: number;
    totalSpent: number;
    totalIssues: number;
    totalResolved: number;
    orgCount: number;
    executionRate: number;
    resolutionRate: number;
    costPerResolved: number | null;
}

export interface EfficiencyAnomaly extends EfficiencyOrg {
    flag: 'critical' | 'warning';
}

export interface EfficiencyData {
    summary: {
        totalOrgs: number;
        totalBudget: number;
        totalSpent: number;
        avgExecutionRate: number;
        totalIssues: number;
        totalResolved: number;
        avgResolutionRate: number;
        avgCostPerResolved: number | null;
        anomalyCount: number;
    };
    districts: EfficiencyDistrict[];
    anomalies: EfficiencyAnomaly[];
    orgs: EfficiencyOrg[];
}

export interface DistrictProfile {
    district: string;
    organizations: {
        total: number;
        byType: Record<string, number>;
        budget: { committedUZS: number; spentUZS: number; executionRate: number };
    };
    infrastructure: {
        total: number;
        byType: Record<string, number>;
        budget: { committedUZS: number; spentUZS: number; executionRate: number };
    };
    issues: {
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
        resolutionRate: number;
        avgResolutionDays: number | null;
        totalVotes: number;
        bySeverity: Record<string, number>;
        byCategory: Array<{ category: string; total: number; resolved: number; resolutionRate: number; votes: number }>;
    };
    monthlyTrend: Array<{ label: string; total: number; resolved: number }>;
    topIssues: Array<{ id: string; title: string; category: string; severity: string; status: string; votes: number; organizationName: string }>;
}

// ── Main analytics hook ─────────────────────────────────

export const useAnalytics = () => {
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [districtScoring, setDistrictScoring] = useState<DistrictScore[]>([]);
    const [regionSummary, setRegionSummary] = useState<RegionSummary[]>([]);
    const [issueAnalytics, setIssueAnalytics] = useState<IssueAnalytics | null>(null);
    const [cropAnalytics, setCropAnalytics] = useState<CropAnalytics | null>(null);
    const [budgetAnalytics, setBudgetAnalytics] = useState<BudgetAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state the dashboard destructures
    const [regionCode, setRegionCode] = useState<number | null>(null);
    const [period, setPeriod] = useState<number | null>(null);

    const fetchAll = useCallback(async (rc?: number | null, p?: number | null) => {
        try {
            setLoading(true);
            setError(null);

            const params: Record<string, any> = {};
            if (rc != null) params.regionCode = rc;
            if (p != null) params.period = p;

            const [overviewRes, scoringRes, regionsRes, issuesRes, cropsRes] = await Promise.all([
                api.get('/analytics/overview', { params }),
                api.get('/analytics/districts/scoring', { params }),
                api.get('/analytics/regions/summary', { params }),
                api.get('/analytics/issues', { params }),
                api.get('/analytics/crops', { params })
            ]);

            setOverview(overviewRes.data.data);
            setDistrictScoring(scoringRes.data.data.districts);
            setRegionSummary(regionsRes.data.data);
            setIssueAnalytics(issuesRes.data.data);
            setCropAnalytics(cropsRes.data.data);

            // Budget analytics — try dedicated endpoint, fall back to computing from scoring data
            try {
                const budgetRes = await api.get('/analytics/budget', { params });
                setBudgetAnalytics(budgetRes.data.data);
            } catch {
                // Compute from district scoring data if endpoint doesn't exist
                const districts = scoringRes.data.data.districts as DistrictScore[];
                const withBudget = districts.filter(d => d.budgetCommittedUZS > 0);
                const totalCommitted = withBudget.reduce((s, d) => s + d.budgetCommittedUZS, 0);
                const totalSpent = withBudget.reduce((s, d) => s + d.budgetSpentUZS, 0);
                const totalResolved = withBudget.reduce((s, d) => s + d.resolvedCount, 0);

                setBudgetAnalytics({
                    totals: {
                        committedUZS: totalCommitted,
                        spentUZS: totalSpent,
                        executionRate: totalCommitted > 0 ? Math.round((totalSpent / totalCommitted) * 100) : 0,
                        costPerResolved: totalResolved > 0 ? Math.round(totalSpent / totalResolved) : null,
                    },
                    byDistrict: withBudget
                        .sort((a, b) => b.budgetCommittedUZS - a.budgetCommittedUZS)
                        .map(d => ({
                            districtId: d.districtId,
                            districtName: d.districtName,
                            totalCommittedUZS: d.budgetCommittedUZS,
                            totalSpentUZS: d.budgetSpentUZS,
                            executionRate: d.budgetExecution,
                            resolvedCount: d.resolvedCount,
                            costPerResolved: d.resolvedCount > 0 ? Math.round(d.budgetSpentUZS / d.resolvedCount) : null,
                            budgetPerKm2: d.areaKm2 > 0 ? Math.round(d.budgetCommittedUZS / d.areaKm2) : 0,
                        })),
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to fetch analytics');
            console.error('Analytics fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Refetch when filters change
    useEffect(() => {
        fetchAll(regionCode, period);
    }, [fetchAll, regionCode, period]);

    const fetchDistrictDetail = useCallback(async (districtId: string) => {
        try {
            const res = await api.get(`/analytics/districts/${districtId}/detail`);
            return res.data.data;
        } catch (err) {
            console.error('District detail fetch error:', err);
            return null;
        }
    }, []);

    return {
        overview,
        districtScoring,
        regionSummary,
        issueAnalytics,
        cropAnalytics,
        budgetAnalytics,
        loading,
        error,
        refetch: () => fetchAll(regionCode, period),
        fetchDistrictDetail,
        regionCode,
        setRegionCode,
        period,
        setPeriod,
    };
};

// ── New hooks (added below existing code) ───────────────

export function useTrends(months = 12) {
    const [data, setData] = useState<TrendsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get(`/analytics/trends`, { params: { months } })
            .then(res => setData(res.data))
            .catch(err => console.error('Trends fetch error:', err))
            .finally(() => setLoading(false));
    }, [months]);

    return { data, loading };
}

export function useResolution() {
    const [data, setData] = useState<ResolutionData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get('/analytics/resolution')
            .then(res => setData(res.data))
            .catch(err => console.error('Resolution fetch error:', err))
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
}

export function useEfficiency(regionName?: string) {
    const [data, setData] = useState<EfficiencyData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const params = regionName ? { regionName } : {};
        api.get('/analytics/efficiency', { params })
            .then(res => setData(res.data))
            .catch(err => console.error('Efficiency fetch error:', err))
            .finally(() => setLoading(false));
    }, [regionName]);

    return { data, loading };
}

export function useDistrictProfile(name: string | null) {
    const [data, setData] = useState<DistrictProfile | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!name) { setData(null); return; }
        setLoading(true);
        api.get(`/analytics/district/${encodeURIComponent(name)}`)
            .then(res => setData(res.data))
            .catch(err => console.error('District profile fetch error:', err))
            .finally(() => setLoading(false));
    }, [name]);

    return { data, loading };
}