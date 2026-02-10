import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
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
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me')
};

// Issues API
export const issuesAPI = {
  getAll: (params) => api.get('/issues', { params }),
  getOne: (id) => api.get(`/issues/${id}`),
  create: (data) => api.post('/issues', data),
  update: (id, data) => api.patch(`/issues/${id}`, data),
  delete: (id) => api.delete(`/issues/${id}`),
  vote: (id) => api.post(`/issues/${id}/vote`),
  addComment: (id, data) => api.post(`/issues/${id}/comments`, data),
  getComments: (id) => api.get(`/issues/${id}/comments`)
};

// Organizations API
export const organizationsAPI = {
  getAll: (params) => api.get('/organizations', { params }),
  getOne: (id) => api.get(`/organizations/${id}`),
  getNearby: (params) => api.get('/organizations/nearby', { params })
};

// Admin API
export const adminAPI = {
  getUsers: () => api.get('/admin/users'),
  blockUser: (id, blocked) => api.patch(`/admin/users/${id}/block`, { blocked }),
  uploadOrganizations: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/upload/organizations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  seedData: (data) => api.post('/admin/seed/generate', data),
  clearSeeded: () => api.delete('/admin/seed/clear')
};

// Infrastructure API
export const infrastructureAPI = {
  getAll: async (params = { type, region }) => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.type) queryParams.append('type', params.type);
      if (params?.region) queryParams.append('region', params.region);
      
      const response = await api.get(`/infrastructure?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      return { success: false, error: handleApiError(error) };
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/infrastructure/${id}`);
      return response.data;
    } catch (error) {
      return { success: false, error: handleApiError(error) };
    }
  },

  getNearby: async (lat, lng, maxDistance, type) => {
    try {
      const queryParams = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        ...(maxDistance && { maxDistance: maxDistance.toString() }),
        ...(type && { type })
      });
      
      const response = await api.get(`/infrastructure/nearby?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      return { success: false, error: handleApiError(error) };
    }
  }
};

export default api;