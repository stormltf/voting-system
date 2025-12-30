'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Search, Vote, Calendar, Loader2, CheckCircle2, Users, Upload, RefreshCw } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { voteApi, communityApi } from '@/lib/api';
import { cn, roundStatusMap, voteStatusMap, wechatStatusMap, formatDate } from '@/lib/utils';

interface Round {
  id: number;
  community_id: number;
  community_name: string;
  name: string;
  year: number;
  round_code: string;
  start_date: string;
  end_date: string;
  status: string;
  description: string;
  voted_count: number;
  total_votes: number;
}

interface Vote {
  id: number;
  owner_id: number;
  room_number: string;
  owner_name: string;
  area: number | string;
  parking_no: string;
  parking_area: number | string;
  phone1: string;
  phone2: string;
  phone3: string;
  wechat_status: string;
  wechat_contact: string;
  house_status: string;
  building: string;
  unit: string;
  phase_name: string;
  community_name: string;
  round_name: string;
  vote_status: string;
  vote_phone: string;
  vote_date: string;
  remark: string;
  sweep_status: string;
}

interface Phase {
  id: number;
  name: string;
  code: string;
}

export default function VotesPage() {
  const [activeTab, setActiveTab] = useState<'rounds' | 'records'>('records');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // 轮次表单
  const [showRoundForm, setShowRoundForm] = useState(false);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [roundForm, setRoundForm] = useState({
    name: '',
    year: new Date().getFullYear(),
    round_code: '',
    start_date: '',
    end_date: '',
    status: 'draft' as 'draft' | 'active' | 'closed',
    description: '',
  });

  // 筛选
  const [selectedRound, setSelectedRound] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPhase, setSelectedPhase] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [communityId, setCommunityId] = useState<number | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);

  // 批量操作
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 导入相关
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [voteColumn, setVoteColumn] = useState('');
  const [importing, setImporting] = useState(false);
  const [initializingVotes, setInitializingVotes] = useState(false);


  useEffect(() => {
    const savedId = localStorage.getItem('selectedCommunityId');
    if (savedId) {
      setCommunityId(parseInt(savedId));
    }

    const handleCommunityChange = (e: CustomEvent) => {
      setCommunityId(e.detail.id);
      setSelectedPhase('');
      setSelectedRound('');  // 切换小区时重置轮次选择
    };
    window.addEventListener('communityChanged', handleCommunityChange as EventListener);

    return () => {
      window.removeEventListener('communityChanged', handleCommunityChange as EventListener);
    };
  }, []);

  // 当小区变化时，重新加载该小区的轮次
  useEffect(() => {
    if (communityId) {
      loadRounds();
    } else {
      setRounds([]);
    }
  }, [communityId]);

  useEffect(() => {
    if (communityId) {
      loadPhases();
    }
  }, [communityId]);

  useEffect(() => {
    // 默认选择进行中的轮次
    if (rounds.length > 0 && !selectedRound) {
      const activeRound = rounds.find((r) => r.status === 'active');
      if (activeRound) {
        setSelectedRound(activeRound.id);
      }
    }
  }, [rounds]);

  useEffect(() => {
    if (activeTab === 'records' && selectedRound) {
      loadVotes();
    }
  }, [activeTab, pagination.page, selectedRound, selectedStatus, selectedPhase, search, communityId]);

  const loadPhases = async () => {
    if (!communityId) return;
    try {
      const response = await communityApi.getPhases(communityId);
      setPhases(response.data);
    } catch (error) {
      console.error('加载期数失败:', error);
    }
  };

  const loadRounds = async () => {
    if (!communityId) {
      setRounds([]);
      return;
    }
    try {
      setLoading(true);
      const response = await voteApi.getRounds({ community_id: communityId });
      setRounds(response.data);
    } catch (error) {
      console.error('加载投票轮次失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVotes = async () => {
    // 必须选择轮次和小区才能加载投票记录
    if (!selectedRound || !communityId) {
      setVotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        round_id: selectedRound,
        community_id: communityId,  // 必传
      };
      if (selectedPhase) params.phase_id = selectedPhase;
      if (selectedStatus) params.vote_status = selectedStatus;
      if (search) params.search = search;

      const response = await voteApi.getVotes(params);
      setVotes(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('加载投票记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleSaveRound = async () => {
    if (!communityId) {
      alert('请先选择小区');
      return;
    }
    try {
      if (editingRound) {
        await voteApi.updateRound(editingRound.id, roundForm);
      } else {
        // 创建轮次时必须传入 community_id
        await voteApi.createRound({ ...roundForm, community_id: communityId });
      }
      setShowRoundForm(false);
      setEditingRound(null);
      setRoundForm({
        name: '',
        year: new Date().getFullYear(),
        round_code: '',
        start_date: '',
        end_date: '',
        status: 'draft',
        description: '',
      });
      loadRounds();
    } catch (error: any) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const handleEditRound = (round: Round) => {
    setEditingRound(round);
    setRoundForm({
      name: round.name,
      year: round.year,
      round_code: round.round_code || '',
      start_date: round.start_date?.split('T')[0] || '',
      end_date: round.end_date?.split('T')[0] || '',
      status: round.status as 'draft' | 'active' | 'closed',
      description: round.description || '',
    });
    setShowRoundForm(true);
  };

  const handleDeleteRound = async (id: number) => {
    if (!confirm('确定要删除这个投票轮次吗？相关的投票记录也会被删除。')) {
      return;
    }
    try {
      await voteApi.deleteRound(id);
      loadRounds();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleQuickStatusChange = async (vote: Vote, status: string) => {
    if (!selectedRound) return;
    try {
      await voteApi.saveVote({
        owner_id: vote.owner_id,
        round_id: selectedRound as number,
        vote_status: status,
        vote_date: new Date().toISOString().split('T')[0],
      });
      loadVotes();
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleFieldUpdate = async (vote: Vote, field: string, value: string) => {
    if (!selectedRound) return;
    try {
      await voteApi.saveVote({
        owner_id: vote.owner_id,
        round_id: selectedRound as number,
        vote_status: vote.vote_status || 'pending',
        [field]: value,
      });
      // 不需要 loadVotes，因为输入框已显示新值
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleBatchStatusChange = async (status: string) => {
    if (selectedIds.length === 0 || !selectedRound) {
      alert('请先选择业主');
      return;
    }
    try {
      await voteApi.batchUpdate({
        owner_ids: selectedIds,
        round_id: selectedRound as number,
        vote_status: status,
      });
      setSelectedIds([]);
      loadVotes();
    } catch (error) {
      console.error('批量更新失败:', error);
    }
  };

  // 一键初始化投票记录
  const handleInitVotes = async () => {
    if (!selectedRound || !communityId) {
      alert('请先选择小区和投票轮次');
      return;
    }
    if (!confirm('确定要为所有业主初始化投票记录吗？已有的记录不会被覆盖。')) {
      return;
    }
    try {
      setInitializingVotes(true);
      const response = await voteApi.initVotes(selectedRound as number, communityId);
      alert(`初始化完成！\n创建: ${response.data.created} 条\n跳过（已存在）: ${response.data.skipped} 条`);
      loadVotes();
    } catch (error: any) {
      alert(error.response?.data?.error || '初始化失败');
    } finally {
      setInitializingVotes(false);
    }
  };

  // 导入投票记录
  const handleImportVotes = async () => {
    if (!importFile || !selectedRound || !communityId) {
      alert('请选择文件、小区和投票轮次');
      return;
    }
    try {
      setImporting(true);
      const response = await voteApi.importVotes(
        importFile,
        selectedRound as number,
        communityId,
        voteColumn || undefined
      );
      const result = response.data;
      let message = `导入完成！\n使用列: ${result.voteColumn}\n总计: ${result.success} 条\n  - 已投票: ${result.voted} 条\n  - 待投票: ${result.pending} 条\n未找到: ${result.notFound} 条`;
      if (result.notFoundRooms?.length > 0) {
        message += `\n\n未找到的房间号（前10个）:\n${result.notFoundRooms.join(', ')}`;
      }
      alert(message);
      setShowImportModal(false);
      setImportFile(null);
      setVoteColumn('');
      loadVotes();
    } catch (error: any) {
      alert(error.response?.data?.error || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const roundColumns = [
    { key: 'name', header: '名称' },
    { key: 'year', header: '年份', className: 'w-20' },
    { key: 'round_code', header: '轮次代码', className: 'w-24' },
    {
      key: 'status',
      header: '状态',
      className: 'w-24',
      render: (item: Round) => {
        const status = roundStatusMap[item.status];
        return (
          <span className={cn('px-2 py-0.5 rounded-full text-xs', status?.color)}>
            {status?.label}
          </span>
        );
      },
    },
    {
      key: 'start_date',
      header: '开始日期',
      className: 'w-28',
      render: (item: Round) => formatDate(item.start_date),
    },
    {
      key: 'end_date',
      header: '结束日期',
      className: 'w-28',
      render: (item: Round) => formatDate(item.end_date),
    },
    {
      key: 'voted_count',
      header: '已投票',
      className: 'w-24',
      render: (item: Round) => `${item.voted_count || 0}`,
    },
    {
      key: 'actions',
      header: '操作',
      className: 'w-24',
      render: (item: Round) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEditRound(item)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteRound(item.id)}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const voteColumns = [
    { key: 'phase_name', header: '期数', className: 'whitespace-nowrap' },
    { key: 'room_number', header: '房间号', className: 'whitespace-nowrap' },
    { key: 'owner_name', header: '姓名', className: 'whitespace-nowrap' },
    {
      key: 'area',
      header: '面积',
      className: 'whitespace-nowrap',
      render: (item: Vote) => item.area ? parseFloat(String(item.area)).toFixed(2) : '-',
    },
    { key: 'parking_no', header: '车位号', className: 'whitespace-nowrap' },
    {
      key: 'parking_area',
      header: '车位面积',
      className: 'whitespace-nowrap',
      render: (item: Vote) => item.parking_area ? parseFloat(String(item.parking_area)).toFixed(2) : '-',
    },
    { key: 'phone1', header: '电话1', className: 'whitespace-nowrap' },
    { key: 'phone2', header: '电话2', className: 'whitespace-nowrap' },
    {
      key: 'wechat_status',
      header: '微信状态',
      className: 'whitespace-nowrap',
      render: (item: Vote) => {
        const status = wechatStatusMap[item.wechat_status || ''] || wechatStatusMap[''];
        return (
          <span className={cn('px-2 py-0.5 rounded-full text-xs', status.color)}>
            {status.label}
          </span>
        );
      },
    },
    { key: 'wechat_contact', header: '微信沟通人', className: 'whitespace-nowrap' },
    { key: 'house_status', header: '房屋状态', className: 'whitespace-nowrap' },
    {
      key: 'vote_status',
      header: '投票状态',
      className: 'whitespace-nowrap',
      render: (item: Vote) => (
        <select
          value={item.vote_status || 'pending'}
          onChange={(e) => {
            e.stopPropagation();
            handleQuickStatusChange(item, e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'px-2 py-1 rounded text-xs border cursor-pointer',
            voteStatusMap[item.vote_status || 'pending']?.color
          )}
        >
          {Object.entries(voteStatusMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'remark',
      header: '备注',
      className: 'whitespace-nowrap min-w-32',
      render: (item: Vote) => (
        <input
          type="text"
          defaultValue={item.remark || ''}
          onBlur={(e) => {
            if (e.target.value !== (item.remark || '')) {
              handleFieldUpdate(item, 'remark', e.target.value);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 text-sm border rounded bg-white"
          placeholder="备注..."
        />
      ),
    },
    {
      key: 'sweep_status',
      header: '扫楼情况',
      className: 'whitespace-nowrap min-w-32',
      render: (item: Vote) => (
        <input
          type="text"
          defaultValue={item.sweep_status || ''}
          onBlur={(e) => {
            if (e.target.value !== (item.sweep_status || '')) {
              handleFieldUpdate(item, 'sweep_status', e.target.value);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 text-sm border rounded bg-white"
          placeholder="扫楼..."
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Vote className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">投票管理</h1>
            <p className="text-slate-500 mt-0.5">管理投票轮次和记录投票状态</p>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-1.5 inline-flex gap-1">
        <button
          onClick={() => setActiveTab('records')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
            activeTab === 'records'
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          投票记录
        </button>
        <button
          onClick={() => setActiveTab('rounds')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
            activeTab === 'rounds'
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <Calendar className="w-4 h-4" />
          轮次管理
        </button>
      </div>

      {/* 投票记录 */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* 筛选 */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex flex-wrap gap-4 items-center">
              {/* 搜索框 */}
              <div className="flex-1 min-w-64">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索房间号、姓名..."
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <select
                value={selectedRound}
                onChange={(e) => {
                  setSelectedRound(e.target.value ? parseInt(e.target.value) : '');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">选择投票轮次</option>
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.name} {round.status === 'active' && '(进行中)'}
                  </option>
                ))}
              </select>

              <select
                value={selectedPhase}
                onChange={(e) => {
                  setSelectedPhase(e.target.value ? parseInt(e.target.value) : '');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">全部期数</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">全部状态</option>
                {Object.entries(voteStatusMap).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSearch}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/20 transition-all duration-200 font-medium"
              >
                搜索
              </button>

              {/* 初始化和导入按钮 */}
              {selectedRound && communityId && (
                <>
                  <button
                    onClick={handleInitVotes}
                    disabled={initializingVotes}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-500/20 transition-all duration-200 font-medium disabled:opacity-50"
                  >
                    {initializingVotes ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    初始化记录
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 shadow-md shadow-purple-500/20 transition-all duration-200 font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    导入投票
                  </button>
                </>
              )}
            </div>

            {/* 批量操作 */}
            {selectedIds.length > 0 && (
              <div className="mt-4 flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-blue-700">
                    已选择 {selectedIds.length} 项
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleBatchStatusChange('voted')}
                    className="px-4 py-2 text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 shadow-sm transition-all duration-200 font-medium"
                  >
                    标记已投票
                  </button>
                  <button
                    onClick={() => handleBatchStatusChange('onsite')}
                    className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all duration-200 font-medium"
                  >
                    标记现场投票
                  </button>
                  <button
                    onClick={() => handleBatchStatusChange('refused')}
                    className="px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 shadow-sm transition-all duration-200 font-medium"
                  >
                    标记拒绝
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-4 py-2 text-sm bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all duration-200 font-medium"
                  >
                    取消选择
                  </button>
                </div>
              </div>
            )}
          </div>

          {!communityId ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Vote className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500">请先在左侧菜单选择小区</p>
            </div>
          ) : !selectedRound ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Vote className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500">请先选择投票轮次</p>
            </div>
          ) : (
            <DataTable
              columns={voteColumns}
              data={votes}
              loading={loading}
              pagination={pagination}
              onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
              idKey="owner_id"
            />
          )}
        </div>
      )}

      {/* 投票轮次 */}
      {activeTab === 'rounds' && (
        <div className="space-y-4">
          {!communityId ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500">请先在左侧菜单选择小区</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setEditingRound(null);
                    setRoundForm({
                      name: '',
                      year: new Date().getFullYear(),
                      round_code: '',
                      start_date: '',
                      end_date: '',
                      status: 'draft',
                      description: '',
                    });
                    setShowRoundForm(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  新建轮次
                </button>
              </div>

              <DataTable columns={roundColumns} data={rounds} loading={loading} />
            </>
          )}
        </div>
      )}

      {/* 轮次表单弹窗 */}
      {showRoundForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingRound ? '编辑投票轮次' : '新建投票轮次'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowRoundForm(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={roundForm.name}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="如：2025年B轮业主大会"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    年份 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={roundForm.year}
                    onChange={(e) =>
                      setRoundForm({ ...roundForm, year: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    轮次代码
                  </label>
                  <input
                    type="text"
                    value={roundForm.round_code}
                    onChange={(e) =>
                      setRoundForm({ ...roundForm, round_code: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="如：2025B"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={roundForm.start_date}
                    onChange={(e) =>
                      setRoundForm({ ...roundForm, start_date: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    结束日期
                  </label>
                  <input
                    type="date"
                    value={roundForm.end_date}
                    onChange={(e) =>
                      setRoundForm({ ...roundForm, end_date: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  状态
                </label>
                <select
                  value={roundForm.status}
                  onChange={(e) =>
                    setRoundForm({
                      ...roundForm,
                      status: e.target.value as 'draft' | 'active' | 'closed',
                    })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
                >
                  <option value="draft">草稿</option>
                  <option value="active">进行中</option>
                  <option value="closed">已结束</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  备注
                </label>
                <textarea
                  value={roundForm.description}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowRoundForm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveRound}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导入投票记录弹窗 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    导入投票记录
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setVoteColumn('');
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                <p className="font-medium mb-2">Excel 格式要求：</p>
                <ul className="list-disc list-inside space-y-1 text-blue-600">
                  <li>必须包含"房间号"列</li>
                  <li>投票状态列（如"25B投否"），值为 1 表示已投票</li>
                  <li>可选：备注列、扫楼情况列</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  选择 Excel 文件 <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                {importFile && (
                  <p className="mt-2 text-sm text-slate-500">
                    已选择: {importFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  投票状态列名（可选）
                </label>
                <input
                  type="text"
                  value={voteColumn}
                  onChange={(e) => setVoteColumn(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="如：25B投否（留空则自动查找包含'投否'的列）"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setVoteColumn('');
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleImportVotes}
                  disabled={!importFile || importing}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {importing ? '导入中...' : '开始导入'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
