// frontend/src/services/api.ts

import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

const API_BASE_URL = "/api";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — attach JWT
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — redirect to /login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const is401 = error.response?.status === 401;
    const isAuthEndpoint: boolean =
      error.config?.url?.includes("/auth/login") ||
      error.config?.url?.includes("/auth/register");
    const alreadyOnLogin = window.location.pathname === "/login";

    if (is401 && !isAuthEndpoint && !alreadyOnLogin) {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Param types ───────────────────────────────────────────────────────────────

interface IssueFilterParams {
  category?: string;
  status?: string;
  severity?: string;
  regionCode?: number;
  objectId?: string;
}

interface ObjectFilterParams {
  objectType?: string;
  sourceApi?: string;
  regionCode?: number;
  districtId?: string;
}

interface ApiResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (data: {
    name: string;
    email: string;
    password: string;
  }): Promise<AxiosResponse> => api.post("/auth/register", data),
  login: (data: { email: string; password: string }): Promise<AxiosResponse> =>
    api.post("/auth/login", data),
  getMe: (): Promise<AxiosResponse> => api.get("/auth/me"),
};

// ── Markers (lightweight, map display) ───────────────────────────────────────

export const markersAPI = {
  getIssues: (params?: IssueFilterParams): Promise<AxiosResponse> =>
    api.get("/markers/issues", { params }),
  // Single endpoint replacing /markers/organizations + /markers/infrastructure
  getObjects: (params?: ObjectFilterParams): Promise<AxiosResponse> =>
    api.get("/markers/objects", { params }),
};

// ── Issues ────────────────────────────────────────────────────────────────────

export const issuesAPI = {
  getAll: (
    params?: IssueFilterParams & { limit?: number }
  ): Promise<AxiosResponse> => api.get("/issues", { params }),
  getOne: (id: string): Promise<AxiosResponse> => api.get(`/issues/${id}`),
  create: (data: Record<string, any>): Promise<AxiosResponse> =>
    api.post("/issues", data),
  update: (id: string, data: Record<string, any>): Promise<AxiosResponse> =>
    api.patch(`/issues/${id}`, data),
  delete: (id: string): Promise<AxiosResponse> => api.delete(`/issues/${id}`),
  vote: (id: string): Promise<AxiosResponse> => api.post(`/issues/${id}/vote`),
  addComment: (id: string, data: { text: string }): Promise<AxiosResponse> =>
    api.post(`/issues/${id}/comments`, data),
  getComments: (id: string): Promise<AxiosResponse> =>
    api.get(`/issues/${id}/comments`),
};

// ── Objects (replaces organizationsAPI + infrastructureAPI) ───────────────────

export const objectsAPI = {
  getAll: (
    params?: ObjectFilterParams & { limit?: number; offset?: number }
  ): Promise<AxiosResponse> => api.get("/objects", { params }),
  getOne: (id: string): Promise<AxiosResponse> => api.get(`/objects/${id}`),
};

// ── Programs ──────────────────────────────────────────────────────────────────

export const programsAPI = {
  getAll: (params?: {
    status?: string;
    regionCode?: number;
  }): Promise<AxiosResponse> => api.get("/programs", { params }),
  getOne: (id: string): Promise<AxiosResponse> => api.get(`/programs/${id}`),
  create: (data: Record<string, any>): Promise<AxiosResponse> =>
    api.post("/programs", data),
  update: (id: string, data: Record<string, any>): Promise<AxiosResponse> =>
    api.patch(`/programs/${id}`, data),
  delete: (id: string): Promise<AxiosResponse> => api.delete(`/programs/${id}`),
  assignObjects: (id: string): Promise<AxiosResponse> =>
    api.post(`/programs/${id}/assign-objects`),
  addObject: (programId: string, objectId: string): Promise<AxiosResponse> =>
    api.post(`/programs/${programId}/objects/${objectId}`),
  removeObject: (programId: string, objectId: string): Promise<AxiosResponse> =>
    api.delete(`/programs/${programId}/objects/${objectId}`),
  bulkCreateTasks: (
    id: string,
    data: {
      title: string;
      description?: string;
      deadline?: string;
    }
  ): Promise<AxiosResponse> => api.post(`/programs/${id}/bulk-tasks`, data),
  getProgramObjects: (id: string): Promise<AxiosResponse> =>
    api.get(`/programs/${id}/objects`),
  getProgramTaskAnalytics: (id: string): Promise<AxiosResponse> =>
    api.get(`/programs/${id}/task-analytics`),
};

// ── Tasks (replaces promisesAPI) ──────────────────────────────────────────────

export const tasksAPI = {
  // Reads
  getByObject: (targetId: string): Promise<AxiosResponse> =>
    api.get("/tasks", { params: { targetId } }),
  getByProgram: (programId: string): Promise<AxiosResponse> =>
    api.get("/tasks", { params: { programId } }),
  getByAllocation: (allocationId: string): Promise<AxiosResponse> =>
    api.get("/tasks", { params: { allocationId } }),
  getByTarget: (targetId: string): Promise<AxiosResponse> =>
    api.get("/tasks", { params: { targetId } }),
  getStats: (): Promise<AxiosResponse> => api.get("/tasks/stats"),
  // Public — per-object verification counts for map marker coloring
  getVerificationSummary: (): Promise<AxiosResponse> =>
    api.get("/tasks/verification-summary"),

  // Admin writes
  create: (data: Record<string, any>): Promise<AxiosResponse> =>
    api.post("/tasks", data),
  updateStatus: (id: string, status: string): Promise<AxiosResponse> =>
    api.patch(`/tasks/${id}/status`, { status }),
  update: (id: string, data: Record<string, any>): Promise<AxiosResponse> =>
    api.patch(`/tasks/${id}`, data),
  delete: (id: string): Promise<AxiosResponse> => api.delete(`/tasks/${id}`),

  // Citizen actions
  vote: (
    id: string,
    verdict: "confirmed" | "rejected"
  ): Promise<AxiosResponse> => api.post(`/tasks/${id}/vote`, { verdict }),
  uploadPhoto: (file: File): Promise<AxiosResponse> => {
    const formData = new FormData();
    formData.append("photo", file);
    return api.post("/tasks/upload-photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  verify: (
    id: string,
    data: { status: "done" | "problem"; comment?: string; photoUrl?: string }
  ): Promise<AxiosResponse> => api.post(`/tasks/${id}/verify`, data),
};

// ── Budget Allocations ────────────────────────────────────────────────────────

export const allocationsAPI = {
  getByTarget: (targetType: string, targetId: string): Promise<AxiosResponse> =>
    api.get("/allocations", { params: { targetType, targetId } }),
  create: (data: Record<string, any>): Promise<AxiosResponse> =>
    api.post("/allocations", data),
  update: (id: string, data: Record<string, any>): Promise<AxiosResponse> =>
    api.patch(`/allocations/${id}`, data),
  delete: (id: string): Promise<AxiosResponse> =>
    api.delete(`/allocations/${id}`),
};

// ── Regions ───────────────────────────────────────────────────────────────────

export const regionsAPI = {
  getAll: (): Promise<AxiosResponse> => api.get("/regions"),
  getByCode: (code: number): Promise<AxiosResponse> =>
    api.get(`/regions/${code}`),
};

// ── Districts ───────────────────────────────────────────────────────────────────

export const districtsAPI = {
  getAll: (params?: { regionCode?: number }): Promise<AxiosResponse> =>
    api.get("/districts", { params }),
  getById: (id: string): Promise<AxiosResponse> => api.get(`/districts/${id}`),
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminAPI = {
  getUsers: (): Promise<AxiosResponse> => api.get("/admin/users"),
  blockUser: (id: string, blocked: boolean): Promise<AxiosResponse> =>
    api.patch(`/admin/users/${id}/block`, { blocked }),
  syncObjects: (): Promise<AxiosResponse> => api.post("/admin/sync-objects"),
  getJobStatus: (jobId: string): Promise<AxiosResponse> =>
    api.get(`/admin/jobs/${jobId}`),
  seedData: (data: Record<string, any>): Promise<AxiosResponse> =>
    api.post("/admin/seed/generate", data),
  clearSeeded: (): Promise<AxiosResponse> => api.delete("/admin/seed/clear"),
  getUserActivity: (id: string): Promise<AxiosResponse> =>
    api.get(`/users/${id}/activity`),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const usersAPI = {
  getMyActivity: (): Promise<AxiosResponse> => api.get("/users/me/activity"),
  getLeaderboard: (): Promise<AxiosResponse> => api.get("/users/leaderboard"),
};

// ── Backward-compat aliases — prevent import errors in components not yet migrated ──

/** @deprecated use tasksAPI */
export const promisesAPI = {
  getByOrg: (orgId: string) => tasksAPI.getByObject(orgId),
  getByInfra: (infraId: string) => tasksAPI.getByObject(infraId),
  getByTarget: (_type: string, targetId: string) =>
    tasksAPI.getByTarget(targetId),
  getByAllocation: (allocationId: string) =>
    tasksAPI.getByAllocation(allocationId),
  getStats: () => tasksAPI.getStats(),
  create: (data: Record<string, any>) => tasksAPI.create(data),
  updateStatus: (id: string, status: string) =>
    tasksAPI.updateStatus(id, status),
  update: (id: string, data: Record<string, any>) => tasksAPI.update(id, data),
  delete: (id: string) => tasksAPI.delete(id),
  uploadPhoto: (file: File) => tasksAPI.uploadPhoto(file),
  verify: (id: string, data: any) => tasksAPI.verify(id, data),
  vote: (id: string, verdict: "confirmed" | "rejected") =>
    tasksAPI.vote(id, verdict),
};

/** @deprecated use objectsAPI */
export const organizationsAPI = {
  getAll: (params?: any) => objectsAPI.getAll(params),
  getOne: (id: string) => objectsAPI.getOne(id),
  getNearby: (_p: any) => objectsAPI.getAll(_p),
};

/** @deprecated use objectsAPI */
export const infrastructureAPI = {
  getAll: async (params?: any): Promise<ApiResult> => {
    try {
      const r = await objectsAPI.getAll(params);
      return r.data;
    } catch (e: any) {
      return { success: false, error: e.message, data: [] };
    }
  },
  getById: async (id: string): Promise<ApiResult> => {
    try {
      const r = await objectsAPI.getOne(id);
      return r.data;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

export const indicatorVerifAPI = {
  getForObject: (objectId: string): Promise<AxiosResponse> =>
    api.get(`/objects/${objectId}/indicator-verifications`),
  submit: (
    objectId: string,
    data: {
      field: string;
      status: "confirmed" | "disputed";
      rating?: number;
      comment?: string;
    }
  ): Promise<AxiosResponse> =>
    api.post(`/objects/${objectId}/indicator-verifications`, data),
};

export default api;
