import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加 token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 认证 API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.put('/auth/password', { oldPassword, newPassword }),
  // 用户管理
  getUsers: () => api.get('/auth/users'),
  createUser: (data: { username: string; password: string; name?: string; role?: string }) =>
    api.post('/auth/users', data),
  updateUser: (id: number, data: { name?: string; role?: string; password?: string }) =>
    api.put(`/auth/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/auth/users/${id}`),
};

// 小区 API
export const communityApi = {
  getAll: () => api.get('/communities'),
  getOne: (id: number) => api.get(`/communities/${id}`),
  create: (data: any) => api.post('/communities', data),
  update: (id: number, data: any) => api.put(`/communities/${id}`, data),
  delete: (id: number) => api.delete(`/communities/${id}`),
  // 期数
  getPhases: (communityId: number) => api.get(`/communities/${communityId}/phases`),
  createPhase: (communityId: number, data: any) =>
    api.post(`/communities/${communityId}/phases`, data),
  updatePhase: (id: number, data: any) => api.put(`/communities/phases/${id}`, data),
  deletePhase: (id: number) => api.delete(`/communities/phases/${id}`),
};

// 业主 API
export const ownerApi = {
  getAll: (params?: any) => api.get('/owners', { params }),
  getOne: (id: number) => api.get(`/owners/${id}`),
  create: (data: any) => api.post('/owners', data),
  update: (id: number, data: any) => api.put(`/owners/${id}`, data),
  delete: (id: number) => api.delete(`/owners/${id}`),
  import: (file: File, phaseId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('phase_id', String(phaseId));
    return api.post('/owners/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getBuildings: (phaseId: number) => api.get(`/owners/buildings/${phaseId}`),
};

// 投票 API
export const voteApi = {
  // 轮次
  getRounds: (params?: { community_id?: number }) => api.get('/votes/rounds', { params }),
  getRound: (id: number) => api.get(`/votes/rounds/${id}`),
  createRound: (data: any) => api.post('/votes/rounds', data),
  updateRound: (id: number, data: any) => api.put(`/votes/rounds/${id}`, data),
  deleteRound: (id: number) => api.delete(`/votes/rounds/${id}`),
  // 投票记录
  getVotes: (params?: any) => api.get('/votes', { params }),
  saveVote: (data: any) => api.post('/votes', data),
  batchUpdate: (data: any) => api.put('/votes/batch', data),
  // 统计
  getStats: (params?: any) => api.get('/votes/stats', { params }),
  getProgress: (params?: any) => api.get('/votes/progress', { params }),
};

// 操作日志 API
export const logsApi = {
  getLogs: (params?: {
    page?: number;
    limit?: number;
    user_id?: number;
    action?: string;
    module?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => api.get('/logs', { params }),
  getStats: (days?: number) => api.get('/logs/stats', { params: { days } }),
  getFilters: () => api.get('/logs/filters'),
};

export default api;
