import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api';

// 类型定义
export interface Community {
  id: number;
  name: string;
  address?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Phase {
  id: number;
  community_id: number;
  name: string;
  code: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Owner {
  id: number;
  phase_id: number;
  seq_no?: number;
  building?: string;
  unit?: string;
  room?: string;
  room_number: string;
  owner_name?: string;
  area?: number;
  parking_no?: string;
  parking_area?: number;
  phone1?: string;
  phone2?: string;
  phone3?: string;
  wechat_status?: string;
  wechat_contact?: string;
  house_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VoteRound {
  id: number;
  community_id: number;
  name: string;
  year: number;
  round_code?: string;
  start_date?: string;
  end_date?: string;
  status?: 'draft' | 'active' | 'closed';
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Vote {
  id: number;
  owner_id: number;
  round_id: number;
  vote_status: 'pending' | 'voted' | 'refused' | 'onsite' | 'video';
  vote_phone?: string;
  vote_date?: string;
  remark?: string;
  sweep_status: string;
  sweep_remark?: string;
  sweep_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  username: string;
  name?: string;
  role: 'super_admin' | 'community_admin' | 'community_user';
  community_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface OperationLog {
  id: number;
  user_id?: number;
  username?: string;
  action: string;
  module: string;
  target_type?: string;
  target_id?: number;
  target_name?: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

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
  createUser: (data: { username: string; password: string; name?: string; role?: string; communityId?: number | null }) =>
    api.post('/auth/users', data),
  updateUser: (id: number, data: { name?: string; role?: string; password?: string; communityId?: number | null }) =>
    api.put(`/auth/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/auth/users/${id}`),
};

// 小区 API
export const communityApi = {
  getAll: () => api.get('/communities'),
  getOne: (id: number) => api.get(`/communities/${id}`),
  create: (data: Omit<Community, 'id' | 'created_at' | 'updated_at'>) => api.post('/communities', data),
  update: (id: number, data: Partial<Community>) => api.put(`/communities/${id}`, data),
  delete: (id: number) => api.delete(`/communities/${id}`),
  // 期数
  getPhases: (communityId: number) => api.get(`/communities/${communityId}/phases`),
  createPhase: (communityId: number, data: { name: string; code: string; description?: string }) =>
    api.post(`/communities/${communityId}/phases`, data),
  updatePhase: (id: number, data: Partial<Phase>) => api.put(`/communities/phases/${id}`, data),
  deletePhase: (id: number) => api.delete(`/communities/phases/${id}`),
};

// 业主 API
export const ownerApi = {
  getAll: (params?: {
    phase_id?: number;
    community_id?: number;
    building?: string;
    search?: string;
    round_id?: number;
    vote_status?: string;
    page?: number;
    limit?: number;
  }) => api.get('/owners', { params }),
  getOne: (id: number) => api.get(`/owners/${id}`),
  create: (data: Omit<Owner, 'id' | 'created_at' | 'updated_at'>) => api.post('/owners', data),
  update: (id: number, data: Partial<Owner>) => api.put(`/owners/${id}`, data),
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
  getUnits: (phaseId: number, building: string) => api.get(`/owners/units/${phaseId}/${building}`),
  // 导出
  getExportUrl: (params?: {
    phase_id?: number;
    community_id?: number;
    building?: string;
    search?: string;
    round_id?: number;
    vote_status?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    return `${API_BASE_URL}/owners/export?${searchParams.toString()}`;
  },
};

// 投票 API
export const voteApi = {
  // 轮次
  getRounds: (params?: { community_id?: number }) => api.get('/votes/rounds', { params }),
  getRound: (id: number) => api.get(`/votes/rounds/${id}`),
  createRound: (data: Omit<VoteRound, 'id' | 'created_at' | 'updated_at'>) =>
    api.post('/votes/rounds', data),
  updateRound: (id: number, data: Partial<VoteRound>) => api.put(`/votes/rounds/${id}`, data),
  deleteRound: (id: number) => api.delete(`/votes/rounds/${id}`),
  // 投票记录
  getVotes: (params?: {
    round_id: number;
    phase_id?: number;
    building?: string;
    unit?: string;
    vote_status?: string;
    search?: string;
  }) => api.get('/votes', { params }),
  saveVote: (data: Partial<Vote>) => api.post('/votes', data),
  batchUpdate: (data: { owner_ids: number[]; vote_status: string; round_id: number; community_id: number }) =>
    api.put('/votes/batch', data),
  // 初始化和导入
  initVotes: (roundId: number, communityId: number) =>
    api.post('/votes/init', { round_id: roundId, community_id: communityId }),
  importVotes: (file: File, roundId: number, communityId: number, voteColumn?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('round_id', String(roundId));
    formData.append('community_id', String(communityId));
    if (voteColumn) formData.append('vote_column', voteColumn);
    return api.post('/votes/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // 统计
  getStats: (params?: {
    community_id?: number;
    round_id?: number;
    phase_id?: number;
  }) => api.get('/votes/stats', { params }),
  getProgress: (params?: {
    community_id?: number;
    round_id?: number;
  }) => api.get('/votes/progress', { params }),
  // 楼栋可视化
  getUnitRooms: (params: { round_id: number; phase_id: number; building: string; unit: string }) =>
    api.get('/votes/unit-rooms', { params }),
  getBuildingOverview: (params: { community_id: number; round_id?: number }) =>
    api.get('/votes/building-overview', { params }),
  // 导出
  getExportUrl: (params: {
    round_id: number;
    community_id?: number;
    phase_id?: number;
    vote_status?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    return `${API_BASE_URL}/votes/export?${searchParams.toString()}`;
  },
  // 扫楼状态管理
  getSweepOverview: (params: { community_id: number; round_id?: number }) =>
    api.get('/votes/sweep-overview', { params }),
  getSweepUnitRooms: (params: { round_id: number; phase_id: number; building: string; unit: string }) =>
    api.get('/votes/sweep-unit-rooms', { params }),
  updateSweepStatus: (ownerId: number, data: { round_id: number; sweep_status: string; sweep_remark?: string }) =>
    api.put(`/votes/sweep/${ownerId}`, data),
  batchUpdateSweep: (data: { owner_ids: number[]; round_id: number; sweep_status: string; community_id: number }) =>
    api.put('/votes/sweep-batch', data),
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
