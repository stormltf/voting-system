'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Building, ChevronRight, Building2, Layers, Loader2, MapPin } from 'lucide-react';
import { communityApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Community {
  id: number;
  name: string;
  address: string;
  description: string;
  phase_count: number;
  owner_count: number;
}

interface Phase {
  id: number;
  name: string;
  code: string;
  description: string;
  owner_count: number;
  total_area: number;
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  // 表单状态
  const [showCommunityForm, setShowCommunityForm] = useState(false);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);

  const [communityForm, setCommunityForm] = useState({
    name: '',
    address: '',
    description: '',
  });

  const [phaseForm, setPhaseForm] = useState({
    name: '',
    code: '',
    description: '',
  });

  useEffect(() => {
    loadCommunities();
  }, []);

  useEffect(() => {
    if (selectedCommunity) {
      loadPhases(selectedCommunity.id);
    }
  }, [selectedCommunity]);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      const response = await communityApi.getAll();
      setCommunities(response.data);
      if (response.data.length > 0 && !selectedCommunity) {
        setSelectedCommunity(response.data[0]);
      }
    } catch (error) {
      console.error('加载小区列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPhases = async (communityId: number) => {
    try {
      const response = await communityApi.getPhases(communityId);
      setPhases(response.data);
    } catch (error) {
      console.error('加载期数列表失败:', error);
    }
  };

  // 小区操作
  const handleSaveCommunity = async () => {
    try {
      if (editingCommunity) {
        await communityApi.update(editingCommunity.id, communityForm);
      } else {
        await communityApi.create(communityForm);
      }
      setShowCommunityForm(false);
      setEditingCommunity(null);
      setCommunityForm({ name: '', address: '', description: '' });
      loadCommunities();
    } catch (error: any) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const handleEditCommunity = (community: Community) => {
    setEditingCommunity(community);
    setCommunityForm({
      name: community.name,
      address: community.address || '',
      description: community.description || '',
    });
    setShowCommunityForm(true);
  };

  const handleDeleteCommunity = async (id: number) => {
    if (!confirm('确定要删除这个小区吗？所有相关数据都会被删除。')) {
      return;
    }
    try {
      await communityApi.delete(id);
      if (selectedCommunity?.id === id) {
        setSelectedCommunity(null);
        setPhases([]);
      }
      loadCommunities();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  // 期数操作
  const handleSavePhase = async () => {
    if (!selectedCommunity) return;
    try {
      if (editingPhase) {
        await communityApi.updatePhase(editingPhase.id, phaseForm);
      } else {
        await communityApi.createPhase(selectedCommunity.id, phaseForm);
      }
      setShowPhaseForm(false);
      setEditingPhase(null);
      setPhaseForm({ name: '', code: '', description: '' });
      loadPhases(selectedCommunity.id);
      loadCommunities();
    } catch (error: any) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const handleEditPhase = (phase: Phase) => {
    setEditingPhase(phase);
    setPhaseForm({
      name: phase.name,
      code: phase.code,
      description: phase.description || '',
    });
    setShowPhaseForm(true);
  };

  const handleDeletePhase = async (id: number) => {
    if (!confirm('确定要删除这个期数吗？所有相关业主数据都会被删除。')) {
      return;
    }
    if (!selectedCommunity) return;
    try {
      await communityApi.deletePhase(id);
      loadPhases(selectedCommunity.id);
      loadCommunities();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-slate-500">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">小区管理</h1>
            <p className="text-slate-500 mt-0.5">管理小区和期数信息</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingCommunity(null);
            setCommunityForm({ name: '', address: '', description: '' });
            setShowCommunityForm(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium"
        >
          <Plus className="w-4 h-4" />
          新建小区
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 小区列表 */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-slate-400" />
              <h2 className="font-semibold text-slate-900">小区列表</h2>
              <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {communities.length} 个
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {communities.map((community) => (
              <div
                key={community.id}
                onClick={() => setSelectedCommunity(community)}
                className={cn(
                  'p-4 cursor-pointer transition-all duration-200',
                  selectedCommunity?.id === community.id
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500'
                    : 'hover:bg-slate-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2.5 rounded-xl transition-colors',
                      selectedCommunity?.id === community.id
                        ? 'bg-blue-500 shadow-lg shadow-blue-500/20'
                        : 'bg-slate-100'
                    )}>
                      <Building className={cn(
                        'w-5 h-5',
                        selectedCommunity?.id === community.id ? 'text-white' : 'text-slate-500'
                      )} />
                    </div>
                    <div>
                      <p className={cn(
                        'font-medium',
                        selectedCommunity?.id === community.id ? 'text-blue-900' : 'text-slate-700'
                      )}>{community.name}</p>
                      <p className="text-sm text-slate-500">
                        {community.phase_count} 期 · {community.owner_count} 户
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCommunity(community);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCommunity(community.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className={cn(
                      'w-4 h-4 transition-colors',
                      selectedCommunity?.id === community.id ? 'text-blue-500' : 'text-slate-300'
                    )} />
                  </div>
                </div>
                {community.address && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-2 ml-14">
                    <MapPin className="w-3.5 h-3.5" />
                    {community.address}
                  </div>
                )}
              </div>
            ))}
            {communities.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Building className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">暂无小区</p>
                <p className="text-sm text-slate-400 mt-1">点击上方按钮新建</p>
              </div>
            )}
          </div>
        </div>

        {/* 期数列表 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-400" />
              <h2 className="font-semibold text-slate-900">
                {selectedCommunity ? `${selectedCommunity.name} - 期数管理` : '请选择小区'}
              </h2>
            </div>
            {selectedCommunity && (
              <button
                onClick={() => {
                  setEditingPhase(null);
                  setPhaseForm({ name: '', code: '', description: '' });
                  setShowPhaseForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-500/20 transition-all duration-200 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                新建期数
              </button>
            )}
          </div>

          {selectedCommunity ? (
            <div className="divide-y divide-slate-100">
              {phases.map((phase) => (
                <div key={phase.id} className="p-5 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center border border-slate-200/60 group-hover:from-blue-50 group-hover:to-indigo-50 group-hover:border-blue-200 transition-colors">
                        <Layers className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{phase.name}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">代码: {phase.code}</span>
                          <span>{phase.owner_count || 0} 户</span>
                          <span>{phase.total_area ? parseFloat(String(phase.total_area)).toFixed(2) : 0} m²</span>
                        </p>
                        {phase.description && (
                          <p className="text-sm text-slate-400 mt-1">
                            {phase.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditPhase(phase)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePhase(phase.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {phases.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Layers className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500">暂无期数</p>
                  <p className="text-sm text-slate-400 mt-1">点击上方按钮新建</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500">请先选择一个小区</p>
            </div>
          )}
        </div>
      </div>

      {/* 小区表单弹窗 */}
      {showCommunityForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Building className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingCommunity ? '编辑小区' : '新建小区'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowCommunityForm(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  小区名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={communityForm.name}
                  onChange={(e) =>
                    setCommunityForm({ ...communityForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="如：阳光花园"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  地址
                </label>
                <input
                  type="text"
                  value={communityForm.address}
                  onChange={(e) =>
                    setCommunityForm({ ...communityForm, address: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="小区地址"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  备注
                </label>
                <textarea
                  value={communityForm.description}
                  onChange={(e) =>
                    setCommunityForm({ ...communityForm, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCommunityForm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveCommunity}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 期数表单弹窗 */}
      {showPhaseForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingPhase ? '编辑期数' : '新建期数'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowPhaseForm(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  期数名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phaseForm.name}
                  onChange={(e) =>
                    setPhaseForm({ ...phaseForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="如：二期"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  期数代码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phaseForm.code}
                  onChange={(e) =>
                    setPhaseForm({ ...phaseForm, code: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="如：2"
                />
                <p className="text-xs text-slate-500 mt-2">
                  用于区分不同期数，同一小区内必须唯一
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  备注
                </label>
                <textarea
                  value={phaseForm.description}
                  onChange={(e) =>
                    setPhaseForm({ ...phaseForm, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPhaseForm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSavePhase}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
