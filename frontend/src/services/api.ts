import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api: AxiosInstance = axios.create({
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
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
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

// ─── Types ────────────────────────────────────────────

interface IssueFilterParams {
  category?: string;
  status?: string;
  severity?: string;
}

interface OrgFilterParams {
  type?: string;
}

interface InfraFilterParams {
  type?: string;
  region?: string;
}

interface NearbyParams {
  lat: number;
  lng: number;
  maxDistance?: number;
  type?: string;
}

interface ApiResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ─── Auth API ─────────────────────────────────────────

export const authAPI = {
  register: (data: { name: string; email: string; password: string }): Promise<AxiosResponse> =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }): Promise<AxiosResponse> =>
    api.post('/auth/login', data),
  getMe: (): Promise<AxiosResponse> =>
    api.get('/auth/me')
};

// ─── Markers API (lightweight, for map display) ───────

export const markersAPI = {
  getIssues: (params?: IssueFilterParams): Promise<AxiosResponse> =>
    api.get('/markers/issues', { params }),
  getOrganizations: (params?: OrgFilterParams): Promise<AxiosResponse> =>
    api.get('/markers/organizations', { params }),
  getInfrastructure: (params?: InfraFilterParams): Promise<AxiosResponse> =>
    api.get('/markers/infrastructure', { params }),
};

// ─── Full detail APIs (on-demand, when user clicks) ───

export const issuesAPI = {
  getAll: (params?: IssueFilterParams & { limit?: number }): Promise<AxiosResponse> =>
    api.get('/issues', { params }),
  getOne: (id: string): Promise<AxiosResponse> =>
    api.get(`/issues/${id}`),
  create: (data: Record<string, any>): Promise<AxiosResponse> =>
    api.post('/issues', data),
  update: (id: string, data: Record<string, any>): Promise<AxiosResponse> =>
    api.patch(`/issues/${id}`, data),
  delete: (id: string): Promise<AxiosResponse> =>
    api.delete(`/issues/${id}`),
  vote: (id: string): Promise<AxiosResponse> =>
    api.post(`/issues/${id}/vote`),
  addComment: (id: string, data: { text: string }): Promise<AxiosResponse> =>
    api.post(`/issues/${id}/comments`, data),
  getComments: (id: string): Promise<AxiosResponse> =>
    api.get(`/issues/${id}/comments`)
};

// ─── Organizations API ────────────────────────────────

export const organizationsAPI = {
  getAll: (params?: OrgFilterParams): Promise<AxiosResponse> =>
    api.get('/organizations', { params }),
  getOne: (id: string): Promise<AxiosResponse> =>
    api.get(`/organizations/${id}`),
  getNearby: (params?: NearbyParams): Promise<AxiosResponse> =>
    api.get('/organizations/nearby', { params })
};

// ─── Admin API ────────────────────────────────────────

export const adminAPI = {
  getUsers: (): Promise<AxiosResponse> =>
    api.get('/admin/users'),
  blockUser: (id: string, blocked: boolean): Promise<AxiosResponse> =>
    api.patch(`/admin/users/${id}/block`, { blocked }),
  uploadOrganizations: (file: File): Promise<AxiosResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/upload/organizations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  seedData: (data: Record<string, any>): Promise<AxiosResponse> =>
    api.post('/admin/seed/generate', data),
  clearSeeded: (): Promise<AxiosResponse> =>
    api.delete('/admin/seed/clear')
};

// ─── Infrastructure API ───────────────────────────────

export const infrastructureAPI = {
  getAll: async (params?: InfraFilterParams): Promise<ApiResult> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.type) queryParams.append('type', params.type);
      if (params?.region) queryParams.append('region', params.region);

      const queryString = queryParams.toString();
      const url = queryString ? `/infrastructure?${queryString}` : '/infrastructure';
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  },
  getById: async (id: string): Promise<ApiResult> => {
    try {
      const response = await api.get(`/infrastructure/${id}`);
      return response.data;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  getNearby: async (lat: number, lng: number, maxDistance: number = 5000, type?: string): Promise<ApiResult> => {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        maxDistance: String(maxDistance)
      });
      if (type) params.append('type', type);
      const response = await api.get(`/infrastructure/nearby?${params}`);
      return response.data;
    } catch (error: any) {
      return { success: false, error: error.message, data: [] };
    }
  }
};