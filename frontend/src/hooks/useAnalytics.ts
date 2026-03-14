// frontend/src/hooks/useAnalytics.ts
//
// Data hooks for AnalyticsDashboard.
// Architecture: Object_ / Task / Issue — no Organization/Infrastructure/Budget.

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = "/api";

const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OverviewData {
  objects: { total: number };
  issues: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    totalVotes: number;
  };
  tasks: { total: number; completed: number; completionRate: number | null };
}

export interface IssueAnalytics {
  total: number;
  byCategory: Array<{ _id: string; count: number; votes: number }>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  trends: Array<{
    year: number;
    month: number;
    count: number;
    resolved: number;
  }>;
  topVoted: Array<{
    _id: string;
    title: string;
    category: string;
    severity: string;
    status: string;
    votes: number;
  }>;
}

export interface ObjectAnalytics {
  byType: Array<{ _id: string; count: number }>;
  byRegion: Array<{ _id: string; count: number }>;
}

export interface DistrictScore {
  districtId: string;
  districtName: { en: string; ru: string; uz: string };
  regionCode: number;
  areaKm2: number;
  issueCount: number;
  openCount: number;
  resolvedCount: number;
  objectCount: number;
  rank: number;
  scores: {
    composite: number;
    issues: number;
    objects: number;
    verification: number;
  };
}

export interface RegionSummary {
  code: number;
  name: { en: string; ru: string; uz: string };
  issueCount: number;
  resolvedCount: number;
  resolutionRate: number | null;
  objectCount: number;
}

export interface TaskStats {
  total: number;
  byStatus: Record<string, number>;
  verifications: { done: number; problem: number };
}

export interface CropAnalytics {
  cropTotals: Array<{
    _id: number;
    name: string;
    color: string;
    districtCount: number;
  }>;
  byDistrict: Array<{
    _id: string;
    districtName: { uz: string };
    cropCount: number;
  }>;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export const useAnalytics = (initialRegionCode?: number | null) => {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [issueAnalytics, setIssueAnalytics] = useState<IssueAnalytics | null>(
    null
  );
  const [objectAnalytics, setObjectAnalytics] =
    useState<ObjectAnalytics | null>(null);
  const [districtScoring, setDistrictScoring] = useState<DistrictScore[]>([]);
  const [regionSummary, setRegionSummary] = useState<RegionSummary[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [cropAnalytics, setCropAnalytics] = useState<CropAnalytics | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problematicFacilities, setProblematicFacilities] = useState<any[]>([]);

  const [regionCode, setRegionCode] = useState<number | null>(initialRegionCode ?? null);

  const fetchAll = useCallback(async (rc?: number | null) => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, any> = {};
      if (rc != null) params.regionCode = rc;

      const [
        overviewRes,
        issuesRes,
        infraRes,
        scoringRes,
        regionsRes,
        cropsRes,
        problematicRes
      ] = await Promise.all([
        api.get("/analytics/overview", { params }),
        api.get("/analytics/issues", { params }),
        api.get("/analytics/infrastructure", { params }),
        api.get("/analytics/districts/scoring", { params }),
        api.get("/analytics/regions/summary"),
        api.get("/analytics/crops", { params }),
        api.get("/analytics/problematic-facilities", { params }),
      ]);

      setOverview(overviewRes.data.data);
      setIssueAnalytics(issuesRes.data.data);
      setObjectAnalytics(infraRes.data.data);
      setDistrictScoring(scoringRes.data.data?.districts || []);
      setRegionSummary(regionsRes.data.data || []);
      setCropAnalytics(cropsRes.data.data);
      setProblematicFacilities(problematicRes.data?.data?.facilities || []);

      // Task stats — public endpoint on /api/tasks/stats
      try {
        const taskRes = await api.get("/tasks/stats");
        if (taskRes.data?.success) setTaskStats(taskRes.data.data);
      } catch {
        /* non-critical */
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error || err.message || "Failed to fetch analytics"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(regionCode);
  }, [fetchAll, regionCode]);

  return {
    overview,
    issueAnalytics,
    objectAnalytics,
    districtScoring,
    regionSummary,
    taskStats,
    cropAnalytics,
    loading,
    error,
    refetch: () => fetchAll(regionCode),
    regionCode,
    setRegionCode,
    problematicFacilities,
  };
};
