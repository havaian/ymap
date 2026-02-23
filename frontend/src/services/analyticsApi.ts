// frontend/src/services/analyticsApi.ts

import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

interface AnalyticsParams {
    regionCode?: number;
    districtId?: string;
    period?: number;
}

export const analyticsAPI = {
    getOverview: (): Promise<AxiosResponse> =>
        api.get('/analytics/overview'),

    getIssues: (params?: AnalyticsParams): Promise<AxiosResponse> =>
        api.get('/analytics/issues', { params }),

    getInfrastructure: (params?: AnalyticsParams): Promise<AxiosResponse> =>
        api.get('/analytics/infrastructure', { params }),

    getCrops: (params?: Pick<AnalyticsParams, 'regionCode'>): Promise<AxiosResponse> =>
        api.get('/analytics/crops', { params }),

    getDistrictScoring: (params?: Pick<AnalyticsParams, 'regionCode'>): Promise<AxiosResponse> =>
        api.get('/analytics/districts/scoring', { params }),

    getDistrictDetail: (id: string): Promise<AxiosResponse> =>
        api.get(`/analytics/districts/${id}`),

    getRegionSummary: (): Promise<AxiosResponse> =>
        api.get('/analytics/regions/summary'),
};