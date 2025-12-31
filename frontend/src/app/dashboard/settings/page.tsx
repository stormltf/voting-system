'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, logsApi, communityApi } from '@/lib/api';
import {
  User, Lock, Check, Settings, Users, Plus, Edit, Trash2, X, Loader2,
  Shield, UserCog, ClipboardList, Search, Calendar, ChevronLeft, ChevronRight,
  Activity, LogIn, UserPlus, Pencil, Trash, FileUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemUser {
  id: number;
  username: string;
  name: string;
  role: string;
  communityId: number | null;
  communityName: string | null;
  createdAt: string;
}

interface Community {
  id: number;
  name: string;
}

// 角色映射
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: '超级管理员', color: 'bg-purple-100 text-purple-700' },
  community_admin: { label: '小区管理员', color: 'bg-blue-100 text-blue-700' },
  community_user: { label: '普通用户', color: 'bg-slate-100 text-slate-600' },
};

interface OperationLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  module: string;
  target_type: string;
  target_id: number;
  target_name: string;
  details: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  login: { label: '登录', icon: LogIn, color: 'bg-green-100 text-green-700' },
  logout: { label: '登出', icon: LogIn, color: 'bg-slate-100 text-slate-700' },
  change_password: { label: '修改密码', icon: Lock, color: 'bg-amber-100 text-amber-700' },
  create: { label: '创建', icon: UserPlus, color: 'bg-blue-100 text-blue-700' },
  update: { label: '更新', icon: Pencil, color: 'bg-indigo-100 text-indigo-700' },
  delete: { label: '删除', icon: Trash, color: 'bg-red-100 text-red-700' },
  import: { label: '导入', icon: FileUp, color: 'bg-purple-100 text-purple-700' },
  batch_update: { label: '批量更新', icon: Pencil, color: 'bg-cyan-100 text-cyan-700' },
};

const MODULE_LABELS: Record<string, string> = {
  auth: '认证',
  user: '用户',
  community: '小区',
  phase: '期数',
  owner: '业主',
  vote_round: '投票轮次',
  vote: '投票',
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'users' | 'logs'>('profile');

  // 用户列表
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // 用户表单
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'community_user',
    communityId: '' as string | number,
  });
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);

  // 密码修改
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 操作日志
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPagination, setLogsPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 0,
  });
  const [logsFilter, setLogsFilter] = useState({
    search: '',
    action: '',
    module: '',
    start_date: '',
    end_date: '',
  });
  const [filterOptions, setFilterOptions] = useState<{
    actions: string[];
    modules: string[];
  }>({ actions: [], modules: [] });

  // 检查是否是超级管理员
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (activeTab === 'users' && isSuperAdmin) {
      loadUsers();
      loadCommunities();
    }
    if (activeTab === 'logs' && isSuperAdmin) {
      loadLogs();
      loadFilterOptions();
    }
  }, [activeTab, user]);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await authApi.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadCommunities = async () => {
    try {
      const response = await communityApi.getAll();
      setCommunities(response.data);
    } catch (error) {
      console.error('加载小区列表失败:', error);
    }
  };

  const loadLogs = async (page = 1) => {
    try {
      setLogsLoading(true);
      const response = await logsApi.getLogs({
        page,
        limit: logsPagination.limit,
        search: logsFilter.search || undefined,
        action: logsFilter.action || undefined,
        module: logsFilter.module || undefined,
        start_date: logsFilter.start_date || undefined,
        end_date: logsFilter.end_date || undefined,
      });
      setLogs(response.data.logs);
      setLogsPagination({
        ...logsPagination,
        page: response.data.pagination.page,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages,
      });
    } catch (error) {
      console.error('加载操作日志失败:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const response = await logsApi.getFilters();
      setFilterOptions({
        actions: response.data.actions || [],
        modules: response.data.modules || [],
      });
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('新密码长度至少为6位');
      return;
    }

    try {
      setPasswordLoading(true);
      await authApi.changePassword(oldPassword, newPassword);
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setPasswordError(error.response?.data?.error || '修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleOpenUserForm = (userToEdit?: SystemUser) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setUserForm({
        username: userToEdit.username,
        password: '',
        name: userToEdit.name,
        role: userToEdit.role,
        communityId: userToEdit.communityId || '',
      });
    } else {
      setEditingUser(null);
      setUserForm({
        username: '',
        password: '',
        name: '',
        role: 'community_user',
        communityId: '',
      });
    }
    setUserFormError('');
    setShowUserForm(true);
  };

  const handleSaveUser = async () => {
    setUserFormError('');

    if (!editingUser) {
      if (!userForm.username || !userForm.password) {
        setUserFormError('用户名和密码不能为空');
        return;
      }
      if (userForm.password.length < 6) {
        setUserFormError('密码长度至少为6位');
        return;
      }
    }

    // 非超级管理员必须选择小区
    if (userForm.role !== 'super_admin' && !userForm.communityId) {
      setUserFormError('请选择所属小区');
      return;
    }

    try {
      setUserFormLoading(true);
      let communityIdValue: number | null = null;
      if (userForm.role !== 'super_admin' && userForm.communityId) {
        communityIdValue = typeof userForm.communityId === 'number'
          ? userForm.communityId
          : parseInt(String(userForm.communityId), 10);
      }

      if (editingUser) {
        await authApi.updateUser(editingUser.id, {
          name: userForm.name,
          role: userForm.role,
          password: userForm.password || undefined,
          communityId: communityIdValue,
        });
      } else {
        await authApi.createUser({
          username: userForm.username,
          password: userForm.password,
          name: userForm.name || userForm.username,
          role: userForm.role,
          communityId: communityIdValue,
        });
      }
      setShowUserForm(false);
      loadUsers();
    } catch (error: any) {
      setUserFormError(error.response?.data?.error || '保存失败');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('确定要删除这个用户吗？')) {
      return;
    }
    try {
      await authApi.deleteUser(userId);
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleLogsSearch = () => {
    loadLogs(1);
  };

  const handleLogsPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= logsPagination.totalPages) {
      loadLogs(newPage);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-500/20">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">系统设置</h1>
          <p className="text-slate-500 mt-0.5">管理您的账户和系统配置</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 侧边菜单 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200',
                activeTab === 'profile'
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 border-l-4 border-blue-500'
                  : 'hover:bg-slate-50 text-slate-600'
              )}
            >
              <User className="w-5 h-5" />
              <span className="font-medium">个人信息</span>
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200',
                activeTab === 'password'
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 border-l-4 border-blue-500'
                  : 'hover:bg-slate-50 text-slate-600'
              )}
            >
              <Lock className="w-5 h-5" />
              <span className="font-medium">修改密码</span>
            </button>
            {isSuperAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200',
                    activeTab === 'users'
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 border-l-4 border-blue-500'
                      : 'hover:bg-slate-50 text-slate-600'
                  )}
                >
                  <Users className="w-5 h-5" />
                  <span className="font-medium">用户管理</span>
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200',
                    activeTab === 'logs'
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 border-l-4 border-blue-500'
                      : 'hover:bg-slate-50 text-slate-600'
                  )}
                >
                  <ClipboardList className="w-5 h-5" />
                  <span className="font-medium">操作日志</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
            {activeTab === 'profile' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">个人信息</h2>
                </div>

                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      用户名
                    </label>
                    <input
                      type="text"
                      value={user?.username || ''}
                      disabled
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      姓名
                    </label>
                    <input
                      type="text"
                      value={user?.name || ''}
                      disabled
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      角色
                    </label>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                        ROLE_LABELS[user?.role || '']?.color || 'bg-slate-100 text-slate-600'
                      )}>
                        <Shield className="w-4 h-4" />
                        {ROLE_LABELS[user?.role || '']?.label || user?.role}
                      </span>
                    </div>
                  </div>

                  {user?.communityName && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        所属小区
                      </label>
                      <input
                        type="text"
                        value={user.communityName}
                        disabled
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'password' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">修改密码</h2>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-5 max-w-md">
                  {passwordError && (
                    <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      密码修改成功
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      当前密码
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      新密码
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      确认新密码
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium disabled:opacity-50"
                  >
                    {passwordLoading ? '提交中...' : '修改密码'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'users' && isSuperAdmin && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">用户管理</h2>
                  </div>
                  <button
                    onClick={() => handleOpenUserForm()}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    添加用户
                  </button>
                </div>

                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-slate-100 text-slate-600' };
                      const avatarGradient = u.role === 'super_admin'
                        ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                        : u.role === 'community_admin'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                          : 'bg-gradient-to-br from-slate-400 to-slate-500';
                      return (
                      <div key={u.id} className="py-4 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold',
                            avatarGradient
                          )}>
                            {(u.name || u.username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900">{u.name || u.username}</p>
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                roleInfo.color
                              )}>
                                {roleInfo.label}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500">
                              @{u.username}
                              {u.communityName && <span> · {u.communityName}</span>}
                              <span> · 创建于 {formatDate(u.createdAt)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenUserForm(u)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                    })}
                    {users.length === 0 && (
                      <div className="py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                          <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500">暂无用户</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && isSuperAdmin && (
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">操作日志</h2>
                </div>

                {/* 筛选条件 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="搜索用户名/详情..."
                      value={logsFilter.search}
                      onChange={(e) => setLogsFilter({ ...logsFilter, search: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogsSearch()}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm"
                    />
                  </div>
                  <select
                    value={logsFilter.action}
                    onChange={(e) => setLogsFilter({ ...logsFilter, action: e.target.value })}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm cursor-pointer"
                  >
                    <option value="">全部操作</option>
                    {filterOptions.actions.map((action) => (
                      <option key={action} value={action}>
                        {ACTION_LABELS[action]?.label || action}
                      </option>
                    ))}
                  </select>
                  <select
                    value={logsFilter.module}
                    onChange={(e) => setLogsFilter({ ...logsFilter, module: e.target.value })}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm cursor-pointer"
                  >
                    <option value="">全部模块</option>
                    {filterOptions.modules.map((module) => (
                      <option key={module} value={module}>
                        {MODULE_LABELS[module] || module}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleLogsSearch}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-sm font-medium shadow-lg shadow-blue-500/20"
                  >
                    查询
                  </button>
                </div>

                {/* 日志列表 */}
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100">
                      {logs.map((log) => {
                        const actionInfo = ACTION_LABELS[log.action] || { label: log.action, icon: Activity, color: 'bg-slate-100 text-slate-700' };
                        const ActionIcon = actionInfo.icon;
                        return (
                          <div key={log.id} className="py-3 flex items-start gap-4">
                            <div className={cn(
                              'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                              actionInfo.color
                            )}>
                              <ActionIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-900">{log.username || '系统'}</span>
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium',
                                  actionInfo.color
                                )}>
                                  {actionInfo.label}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                  {MODULE_LABELS[log.module] || log.module}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1 truncate">
                                {log.details || `${log.target_type ? `[${log.target_type}] ` : ''}${log.target_name || ''}`}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDateTime(log.created_at)}
                                </span>
                                {log.ip_address && (
                                  <span>IP: {log.ip_address}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {logs.length === 0 && (
                        <div className="py-12 text-center">
                          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <ClipboardList className="w-8 h-8 text-slate-400" />
                          </div>
                          <p className="text-slate-500">暂无操作日志</p>
                        </div>
                      )}
                    </div>

                    {/* 分页 */}
                    {logsPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <p className="text-sm text-slate-500">
                          共 {logsPagination.total} 条记录
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleLogsPageChange(logsPagination.page - 1)}
                            disabled={logsPagination.page <= 1}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <span className="text-sm text-slate-600">
                            {logsPagination.page} / {logsPagination.totalPages}
                          </span>
                          <button
                            onClick={() => handleLogsPageChange(logsPagination.page + 1)}
                            disabled={logsPagination.page >= logsPagination.totalPages}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 用户表单弹窗 */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <UserCog className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingUser ? '编辑用户' : '添加用户'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowUserForm(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {userFormError && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {userFormError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  用户名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  disabled={!!editingUser}
                  className={cn(
                    'w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none transition-all duration-200',
                    editingUser
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white'
                  )}
                  placeholder="请输入用户名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  密码 {!editingUser && <span className="text-red-500">*</span>}
                  {editingUser && <span className="text-slate-400 font-normal">（留空则不修改）</span>}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder={editingUser ? '留空则不修改密码' : '请输入密码（至少6位）'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  姓名
                </label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="请输入姓名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  角色 <span className="text-red-500">*</span>
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value, communityId: e.target.value === 'super_admin' ? '' : userForm.communityId })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
                >
                  <option value="super_admin">超级管理员</option>
                  <option value="community_admin">小区管理员</option>
                  <option value="community_user">普通用户</option>
                </select>
              </div>

              {userForm.role !== 'super_admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    所属小区 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={userForm.communityId}
                    onChange={(e) => setUserForm({ ...userForm, communityId: e.target.value ? parseInt(e.target.value) : '' })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
                  >
                    <option value="">请选择小区</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowUserForm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={userFormLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {userFormLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
