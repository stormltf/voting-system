'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Search, Vote, Calendar, Loader2, CheckCircle2, Users, Upload, RefreshCw, Download } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { voteApi, communityApi, ownerApi } from '@/lib/api';
import { cn, roundStatusMap, voteStatusMap, wechatStatusMap, sweepStatusMap, formatDate } from '@/lib/utils';

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

type VoteStatus = 'pending' | 'voted' | 'refused' | 'onsite' | 'video';

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
  vote_status: VoteStatus;
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

// Mobile card component for votes - Redesigned for better usability
function VoteMobileCard({
  vote,
  isSelected,
  onSelect,
  onStatusChange,
  onSweepChange,
  onRemarkChange,
}: {
  vote: Vote;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: VoteStatus) => void;
  onSweepChange: (status: string) => void;
  onRemarkChange: (remark: string) => void;
}) {
  const isCompleted = vote.vote_status === 'voted' || vote.vote_status === 'onsite' || vote.vote_status === 'video';

  return (
    <div className={cn(
      "p-4 transition-all",
      isSelected && "bg-blue-50/70",
      isCompleted && !isSelected && "opacity-50"
    )}>
      {/* Main row: checkbox + room number (BIG) + status */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-colors cursor-pointer flex-shrink-0"
        />

        {/* Room number - LARGE and prominent */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900">{vote.room_number}</span>
            <span className="text-sm text-slate-400">{vote.phase_name}</span>
          </div>
        </div>

        {/* Status badge - always visible */}
        <div className={cn(
          "px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0",
          voteStatusMap[vote.vote_status || 'pending']?.color
        )}>
          {voteStatusMap[vote.vote_status || 'pending']?.label}
        </div>
      </div>

      {/* Info row: name + phone + area - compact single line */}
      <div className="mt-2 ml-8 flex items-center gap-3 text-sm">
        <span className="text-slate-700 font-medium">{vote.owner_name}</span>
        <span className="text-slate-300">|</span>
        {vote.phone1 ? (
          <a href={`tel:${vote.phone1}`} className="text-blue-600 underline">{vote.phone1}</a>
        ) : (
          <span className="text-slate-400">无电话</span>
        )}
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">{vote.area ? parseFloat(String(vote.area)).toFixed(0) : '-'}㎡</span>
      </div>

      {/* Action row: status selects - larger touch targets */}
      <div className="mt-3 ml-8 flex gap-2">
        <select
          value={vote.vote_status || 'pending'}
          onChange={(e) => {
            e.stopPropagation();
            onStatusChange(e.target.value as VoteStatus);
          }}
          className={cn(
            'flex-1 px-3 py-3 rounded-xl text-sm font-medium border-2 cursor-pointer',
            'bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all',
            vote.vote_status === 'voted' && 'border-emerald-300',
            vote.vote_status === 'refused' && 'border-red-300',
            vote.vote_status === 'onsite' && 'border-blue-300',
            vote.vote_status === 'video' && 'border-purple-300',
            (!vote.vote_status || vote.vote_status === 'pending') && 'border-slate-200'
          )}
        >
          {Object.entries(voteStatusMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
        <select
          value={vote.sweep_status || 'pending'}
          onChange={(e) => {
            e.stopPropagation();
            onSweepChange(e.target.value);
          }}
          className={cn(
            'flex-1 px-3 py-3 rounded-xl text-sm font-medium border-2 cursor-pointer',
            'bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all',
            vote.sweep_status === 'completed' && 'border-emerald-300',
            vote.sweep_status === 'in_progress' && 'border-amber-300',
            (!vote.sweep_status || vote.sweep_status === 'pending') && 'border-slate-200'
          )}
        >
          {Object.entries(sweepStatusMap).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
      </div>

      {/* Remark - expandable on tap */}
      <div className="mt-2 ml-8">
        <input
          type="text"
          defaultValue={vote.remark || ''}
          onBlur={(e) => {
            if (e.target.value !== (vote.remark || '')) {
              onRemarkChange(e.target.value);
            }
          }}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          placeholder="添加备注..."
        />
      </div>
    </div>
  );
}

export default function VotesPage() {
  const [activeTab, setActiveTab] = useState<'rounds' | 'records'>('records');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
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
  const [selectedSweepStatus, setSelectedSweepStatus] = useState<string>('');
  const [selectedPhase, setSelectedPhase] = useState<number | ''>('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [search, setSearch] = useState('');
  const [communityId, setCommunityId] = useState<number | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);

  // 批量操作
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 导入相关
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [voteColumn, setVoteColumn] = useState('');
  const [importing, setImporting] = useState(false);
  const [initializingVotes, setInitializingVotes] = useState(false);

  // 导出状态
  const [exporting, setExporting] = useState(false);

  // 移动端快捷筛选：只看待处理
  const [showPendingOnly, setShowPendingOnly] = useState(false);


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

  const loadPhases = useCallback(async () => {
    if (!communityId) return;
    try {
      const response = await communityApi.getPhases(communityId);
      setPhases(response.data);
    } catch (error) {
      console.error('加载期数失败:', error);
    }
  }, [communityId]);

  const loadRounds = useCallback(async () => {
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
  }, [communityId]);

  const loadVotes = useCallback(async () => {
    // 必须选择轮次和小区才能加载投票记录
    if (!selectedRound || !communityId) {
      setVotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      if (!selectedRound || typeof selectedRound !== 'number') {
        setVotes([]);
        setLoading(false);
        return;
      }
      const params: {
        page?: number;
        limit?: number;
        round_id: number;
        phase_id?: number;
        building?: string;
        unit?: string;
        vote_status?: string;
        sweep_status?: string;
        search?: string;
      } = {
        page: pagination.page,
        limit: pagination.limit,
        round_id: selectedRound,
      };
      if (selectedPhase) params.phase_id = selectedPhase;
      if (selectedBuilding) params.building = selectedBuilding;
      if (selectedUnit) params.unit = selectedUnit;
      if (selectedStatus) params.vote_status = selectedStatus;
      if (selectedSweepStatus) params.sweep_status = selectedSweepStatus;
      if (search) params.search = search;

      const response = await voteApi.getVotes(params);
      setVotes(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('加载投票记录失败:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedRound, communityId, pagination.page, pagination.limit, selectedPhase, selectedBuilding, selectedUnit, selectedStatus, selectedSweepStatus, search]);

  // 当小区变化时，重新加载该小区的轮次
  useEffect(() => {
    if (communityId) {
      loadRounds();
      loadPhases();
    } else {
      setRounds([]);
    }
  }, [communityId, loadRounds, loadPhases]);

  // 当期数变化时，加载楼号列表并重置选择
  useEffect(() => {
    if (selectedPhase) {
      ownerApi.getBuildings(selectedPhase as number)
        .then(response => setBuildings(response.data))
        .catch(error => console.error('加载楼号失败:', error));
    } else {
      setBuildings([]);
    }
    setSelectedBuilding('');
    setSelectedUnit('');
    setUnits([]);
  }, [selectedPhase]);

  // 当楼号变化时，加载单元列表并重置选择
  useEffect(() => {
    if (selectedPhase && selectedBuilding) {
      ownerApi.getUnits(selectedPhase as number, selectedBuilding)
        .then(response => setUnits(response.data))
        .catch(error => console.error('加载单元失败:', error));
    } else {
      setUnits([]);
    }
    setSelectedUnit('');
  }, [selectedPhase, selectedBuilding]);

  useEffect(() => {
    // 默认选择进行中的轮次
    if (rounds.length > 0 && !selectedRound) {
      const activeRound = rounds.find((r) => r.status === 'active');
      if (activeRound) {
        setSelectedRound(activeRound.id);
      }
    }
  }, [rounds, selectedRound]);

  useEffect(() => {
    if (activeTab === 'records' && selectedRound) {
      loadVotes();
    }
  }, [activeTab, selectedRound, loadVotes]);

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
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || '保存失败');
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
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || '删除失败');
    }
  };

  const handleQuickStatusChange = async (vote: Vote, status: 'pending' | 'voted' | 'refused' | 'onsite' | 'video') => {
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
      loadVotes();
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleBatchStatusChange = async (status: string) => {
    if (selectedIds.length === 0 || !selectedRound || !communityId) {
      alert('请先选择业主');
      return;
    }
    try {
      await voteApi.batchUpdate({
        owner_ids: selectedIds,
        round_id: selectedRound as number,
        vote_status: status,
        community_id: communityId,
      });
      setSelectedIds([]);
      loadVotes();
    } catch (error) {
      console.error('批量更新失败:', error);
    }
  };

  const handleBatchSweepStatusChange = async (sweepStatus: string) => {
    if (selectedIds.length === 0 || !selectedRound || !communityId) {
      alert('请先选择业主');
      return;
    }
    try {
      await voteApi.batchUpdateSweep({
        owner_ids: selectedIds,
        round_id: selectedRound as number,
        sweep_status: sweepStatus,
        community_id: communityId,
      });
      setSelectedIds([]);
      loadVotes();
    } catch (error) {
      console.error('批量更新扫楼状态失败:', error);
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
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || '初始化失败');
    } finally {
      setInitializingVotes(false);
    }
  };

  // 导出投票记录
  const handleExport = () => {
    if (!selectedRound || !communityId) {
      alert('请先选择小区和投票轮次');
      return;
    }

    setExporting(true);

    // 构建导出参数（与当前筛选条件一致）
    const params: {
      round_id: number;
      community_id?: number;
      phase_id?: number;
      vote_status?: string;
      search?: string;
    } = {
      round_id: selectedRound as number,
      community_id: communityId || undefined,
    };
    if (selectedPhase) params.phase_id = selectedPhase;
    if (selectedStatus) params.vote_status = selectedStatus;
    if (search) params.search = search;

    // 获取导出 URL
    const exportUrl = voteApi.getExportUrl(params);

    // 使用 fetch 来处理需要认证的下载
    const token = localStorage.getItem('token');
    if (token) {
      fetch(exportUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => {
          if (!response.ok) throw new Error('导出失败');
          return response.blob();
        })
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          // 获取当前轮次名称
          const round = rounds.find(r => r.id === selectedRound);
          const roundName = round?.name || '投票';
          a.download = `${roundName}_投票记录_${new Date().toISOString().slice(0, 10)}.xlsx`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        })
        .catch((error) => {
          console.error('导出失败:', error);
          alert('导出失败，请重试');
        })
        .finally(() => {
          setExporting(false);
        });
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
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || '导入失败');
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
    { key: 'phase_name', header: '期数', className: 'whitespace-nowrap min-w-16', sticky: true, stickyOffset: 0 },
    { key: 'room_number', header: '房间号', className: 'whitespace-nowrap min-w-20', sticky: true, stickyOffset: 64 },
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
            handleQuickStatusChange(item, e.target.value as VoteStatus);
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
      key: 'sweep_status',
      header: '扫楼状态',
      className: 'whitespace-nowrap',
      render: (item: Vote) => (
        <select
          value={item.sweep_status || 'pending'}
          onChange={(e) => {
            e.stopPropagation();
            handleFieldUpdate(item, 'sweep_status', e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'px-2 py-1 rounded text-xs border cursor-pointer',
            sweepStatusMap[item.sweep_status || 'pending']?.color
          )}
        >
          {Object.entries(sweepStatusMap).map(([key, value]) => (
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
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Vote className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">投票管理</h1>
            <p className="text-slate-500 mt-0.5 text-sm md:text-base">管理投票轮次和记录投票状态</p>
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
          {/* 筛选 - Mobile optimized */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 md:p-5">
            {/* Mobile: Simplified layout with quick toggle */}
            <div className="md:hidden space-y-3">
              {/* Search + Quick toggle row */}
              <div className="flex gap-2">
                <div className="flex-1 relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索房号/姓名"
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all text-base"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl font-medium"
                >
                  搜索
                </button>
              </div>

              {/* Quick toggle: 只看待处理 */}
              <button
                onClick={() => setShowPendingOnly(!showPendingOnly)}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all",
                  showPendingOnly
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {showPendingOnly ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    只看待处理（已开启）
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    显示全部 · 点击只看待处理
                  </>
                )}
              </button>

              {/* Essential filters row */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedRound}
                  onChange={(e) => {
                    setSelectedRound(e.target.value ? parseInt(e.target.value) : '');
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 min-h-[48px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all cursor-pointer text-base"
                >
                  <option value="">选择轮次</option>
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      {round.name} {round.status === 'active' && '✓'}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedPhase}
                  onChange={(e) => {
                    setSelectedPhase(e.target.value ? parseInt(e.target.value) : '');
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 min-h-[48px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all cursor-pointer text-base"
                >
                  <option value="">全部期数</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedBuilding}
                  onChange={(e) => {
                    setSelectedBuilding(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  disabled={!selectedPhase || buildings.length === 0}
                  className="w-full px-3 min-h-[48px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all cursor-pointer text-base disabled:opacity-50"
                >
                  <option value="">全部楼号</option>
                  {buildings.map((building) => (
                    <option key={building} value={building}>
                      {building}栋
                    </option>
                  ))}
                </select>

                <select
                  value={selectedUnit}
                  onChange={(e) => {
                    setSelectedUnit(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  disabled={!selectedBuilding || units.length === 0}
                  className="w-full px-3 min-h-[48px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all cursor-pointer text-base disabled:opacity-50"
                >
                  <option value="">全部单元</option>
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}单元
                    </option>
                  ))}
                </select>
              </div>

              {/* Action buttons - only show essential ones */}
              {selectedRound && communityId && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleInitVotes}
                    disabled={initializingVotes}
                    className="flex items-center justify-center gap-1 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {initializingVotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span className="text-sm">初始化</span>
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center justify-center gap-1 py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="text-sm">导出</span>
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center justify-center gap-1 py-3 bg-purple-500 text-white rounded-xl font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">导入</span>
                  </button>
                </div>
              )}
            </div>

            {/* Desktop: Full filter layout */}
            <div className="hidden md:flex md:flex-wrap md:gap-4 md:items-center">
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
                className="px-4 min-h-[44px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">选择轮次</option>
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
                className="px-4 min-h-[44px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">全部期数</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedBuilding}
                onChange={(e) => {
                  setSelectedBuilding(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                disabled={!selectedPhase || buildings.length === 0}
                className="px-4 min-h-[44px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <option value="">全部楼号</option>
                {buildings.map((building) => (
                  <option key={building} value={building}>
                    {building}栋
                  </option>
                ))}
              </select>

              <select
                value={selectedUnit}
                onChange={(e) => {
                  setSelectedUnit(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                disabled={!selectedBuilding || units.length === 0}
                className="px-4 min-h-[44px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <option value="">全部单元</option>
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}单元
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 min-h-[44px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">投票状态</option>
                {Object.entries(voteStatusMap).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedSweepStatus}
                onChange={(e) => {
                  setSelectedSweepStatus(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 min-h-[44px] py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">扫楼状态</option>
                {Object.entries(sweepStatusMap).map(([key, value]) => (
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

              {selectedRound && communityId && (
                <>
                  <button
                    onClick={handleInitVotes}
                    disabled={initializingVotes}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-500/20 transition-all duration-200 font-medium disabled:opacity-50"
                  >
                    {initializingVotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    初始化
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/20 transition-all duration-200 font-medium disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    导出
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 shadow-md shadow-purple-500/20 transition-all duration-200 font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    导入
                  </button>
                </>
              )}
            </div>

            {/* 批量操作 - Mobile optimized */}
            {selectedIds.length > 0 && (
              <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
                {/* Header: count and cancel */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-blue-700">
                      已选 {selectedIds.length} 项
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-3 py-1.5 text-xs sm:text-sm bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all duration-200 font-medium"
                  >
                    取消
                  </button>
                </div>

                {/* Action buttons - horizontal scroll on mobile */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {/* Vote status group */}
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">投票:</span>
                    <button
                      onClick={() => handleBatchStatusChange('voted')}
                      className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 shadow-sm transition-all duration-200 font-medium whitespace-nowrap"
                    >
                      已投票
                    </button>
                    <button
                      onClick={() => handleBatchStatusChange('onsite')}
                      className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all duration-200 font-medium whitespace-nowrap"
                    >
                      现场
                    </button>
                    <button
                      onClick={() => handleBatchStatusChange('refused')}
                      className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 shadow-sm transition-all duration-200 font-medium whitespace-nowrap"
                    >
                      拒绝
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-6 bg-slate-300 flex-shrink-0 self-center mx-1" />

                  {/* Sweep status group */}
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">扫楼:</span>
                    <button
                      onClick={() => handleBatchSweepStatusChange('completed')}
                      className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 shadow-sm transition-all duration-200 font-medium whitespace-nowrap"
                    >
                      完成
                    </button>
                    <button
                      onClick={() => handleBatchSweepStatusChange('in_progress')}
                      className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 shadow-sm transition-all duration-200 font-medium whitespace-nowrap"
                    >
                      进行中
                    </button>
                    <button
                      onClick={() => handleBatchSweepStatusChange('pending')}
                      className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-slate-400 text-white rounded-lg hover:bg-slate-500 shadow-sm transition-all duration-200 font-medium whitespace-nowrap"
                    >
                      待扫
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!communityId ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 md:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Vote className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500">请先在菜单中选择小区</p>
            </div>
          ) : !selectedRound ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 md:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Vote className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500">请先选择投票轮次</p>
            </div>
          ) : (
            (() => {
              // Filter votes based on showPendingOnly toggle (mobile only)
              const completedStatuses = ['voted', 'onsite', 'video'];
              const filteredVotes = showPendingOnly
                ? votes.filter(v => !completedStatuses.includes(v.vote_status || ''))
                : votes;

              return (
                <>
                  {/* Mobile: Show filter result count */}
                  {showPendingOnly && (
                    <div className="md:hidden mb-3 px-1 text-sm text-amber-600 font-medium">
                      显示 {filteredVotes.length} 条待处理（共 {votes.length} 条）
                    </div>
                  )}
                  <DataTable<Vote & Record<string, unknown>>
                    columns={voteColumns as Parameters<typeof DataTable<Vote & Record<string, unknown>>>[0]['columns']}
                    data={filteredVotes as (Vote & Record<string, unknown>)[]}
                    loading={loading}
                    pagination={pagination}
                    onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
                    selectedIds={selectedIds}
                    onSelectChange={setSelectedIds}
                    idKey="owner_id"
                    mobileCardRender={(item, isSelected, onSelect) => (
                      <VoteMobileCard
                        vote={item as unknown as Vote}
                        isSelected={isSelected}
                        onSelect={onSelect}
                        onStatusChange={(status) => handleQuickStatusChange(item as unknown as Vote, status)}
                        onSweepChange={(status) => handleFieldUpdate(item as unknown as Vote, 'sweep_status', status)}
                        onRemarkChange={(remark) => handleFieldUpdate(item as unknown as Vote, 'remark', remark)}
                      />
                    )}
                  />
                </>
              );
            })()
          )}
        </div>
      )}

      {/* 投票轮次 */}
      {activeTab === 'rounds' && (
        <div className="space-y-4">
          {!communityId ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 md:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500">请先在菜单中选择小区</p>
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

              <DataTable<Round & Record<string, unknown>>
                columns={roundColumns as Parameters<typeof DataTable<Round & Record<string, unknown>>>[0]['columns']}
                data={rounds as (Round & Record<string, unknown>)[]}
                loading={loading}
              />
            </>
          )}
        </div>
      )}

      {/* 轮次表单弹窗 - Mobile optimized */}
      {showRoundForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* 弹窗头部 */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">
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

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

      {/* 导入投票记录弹窗 - Mobile optimized */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* 弹窗头部 */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">
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

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="p-3 sm:p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs sm:text-sm text-blue-700">
                <p className="font-medium mb-1.5 sm:mb-2">Excel 格式要求：</p>
                <ul className="list-disc list-inside space-y-0.5 sm:space-y-1 text-blue-600">
                  <li>必须包含「房间号」列</li>
                  <li>投票状态列（如「25B投否」），值为 1 表示已投票</li>
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
                  className="w-full px-3 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 text-sm file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                {importFile && (
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 truncate">
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 text-sm"
                  placeholder="如：25B投否（留空自动查找）"
                />
              </div>

              <div className="flex gap-2 sm:gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setVoteColumn('');
                  }}
                  className="flex-1 py-2.5 sm:py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium text-sm sm:text-base"
                >
                  取消
                </button>
                <button
                  onClick={handleImportVotes}
                  disabled={!importFile || importing}
                  className="flex-1 py-2.5 sm:py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
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
