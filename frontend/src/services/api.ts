// frontend/src/services/api.ts

import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - redirect to login on 401
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    const is401 = error.response?.status === 401;
    // Don't redirect if the 401 came from login/register themselves
    // (wrong password etc.) — that's a normal error the UI handles inline.
    const isAuthEndpoint: boolean =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/register');
    const alreadyOnLogin = window.location.pathname === '/login';

    if (is401 && !isAuthEndpoint && !alreadyOnLogin) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface JobStatus {
  id: string;
  status: 'running' | 'done' | 'error';
  phase: string;
  progress: number;
  total: number;
  result: ImportResult | null;
  error: string | null;
  createdAt: number;
}

export interface ImportResult {
  total: number;
  organizations: number;
  infrastructure: number;
  skipped: number;
}

export interface SeedData {
  issuesCount: number;
  includeComments: boolean;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (data: { name: string; email: string; password: string; district?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () =>
    api.get('/auth/me')
};

// ─── Issues API ───────────────────────────────────────────────────────────────

export const issuesAPI = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/issues', { params }),
  getOne: (id: string) =>
    api.get(`/issues/${id}`),
  create: (data: unknown) =>
    api.post('/issues', data),
  update: (id: string, data: unknown) =>
    api.patch(`/issues/${id}`, data),
  delete: (id: string) =>
    api.delete(`/issues/${id}`),
  vote: (id: string) =>
    api.post(`/issues/${id}/vote`),
  addComment: (id: string, data: { text: string }) =>
    api.post(`/issues/${id}/comments`, data),
  getComments: (id: string) =>
    api.get(`/issues/${id}/comments`)
};

// ─── Organizations API ────────────────────────────────────────────────────────

export const organizationsAPI = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/organizations', { params }),
  getOne: (id: string) =>
    api.get(`/organizations/${id}`),
  getNearby: (params: Record<string, unknown>) =>
    api.get('/organizations/nearby', { params })
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminAPI = {
  getUsers: () =>
    api.get('/admin/users'),
  blockUser: (id: string, blocked: boolean) =>
    api.patch(`/admin/users/${id}/block`, { blocked }),
  uploadOrganizations: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/upload/organizations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getJobStatus: (jobId: string) =>
    api.get<ApiResponse<JobStatus>>(`/admin/jobs/${jobId}`),
  seedData: (data: SeedData) =>
    api.post('/admin/seed/generate', data),
  clearSeeded: () =>
    api.delete('/admin/seed/clear')
};

// ─── Infrastructure API ───────────────────────────────────────────────────────

export const infrastructureAPI = {
  getAll: async (params?: { type?: string; region?: string }) => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.type) queryParams.append('type', params.type);
      if (params?.region) queryParams.append('region', params.region);

      const queryString = queryParams.toString();
      const url = queryString ? `/infrastructure?${queryString}` : '/infrastructure';

      const response = await api.get(url);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      return {
        success: false,
        error: axiosError.response?.data?.message || 'Failed to fetch infrastructure'
      };
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/infrastructure/${id}`);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      return {
        success: false,
        error: axiosError.response?.data?.message || 'Failed to fetch infrastructure'
      };
    }
  },

  getNearby: async (lat: number, lng: number, maxDistance?: number, type?: string) => {
    try {
      const queryParams = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        ...(maxDistance && { maxDistance: maxDistance.toString() }),
        ...(type && { type })
      });

      const response = await api.get(`/infrastructure/nearby?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      return {
        success: false,
        error: axiosError.response?.data?.message || 'Failed to fetch nearby infrastructure'
      };
    }
  }
};

export default api;