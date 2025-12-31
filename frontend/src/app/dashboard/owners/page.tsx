'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Upload, Edit2, Check, X, Users, FileSpreadsheet, Loader2, Download, Plus } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { ownerApi, communityApi } from '@/lib/api';
import { cn, wechatStatusMap } from '@/lib/utils';

interface Owner {
  id: number;
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
  phase_name: string;
  community_name: string;
  building: string;
  unit: string;
}

interface Phase {
  id: number;
  name: string;
  code: string;
}

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 3000,
    total: 0,
    totalPages: 0,
  });

  // 筛选条件
  const [search, setSearch] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<number | ''>('');
  const [selectedWechatStatus, setSelectedWechatStatus] = useState<string>('');

  // 基础数据
  const [phases, setPhases] = useState<Phase[]>([]);
  const [communityId, setCommunityId] = useState<number | null>(null);

  // 导入弹窗
  const [showImport, setShowImport] = useState(false);
  const [importPhaseId, setImportPhaseId] = useState<number | ''>('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // 编辑状态
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Owner>>({});

  // 导出状态
  const [exporting, setExporting] = useState(false);

  // 新增业主弹窗
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPhaseId, setAddPhaseId] = useState<number | ''>('');
  const [addForm, setAddForm] = useState({
    building: '',
    unit: '',
    room: '',
    owner_name: '',
    area: '',
    parking_no: '',
    parking_area: '',
    phone1: '',
    phone2: '',
    phone3: '',
    wechat_status: '',
    wechat_contact: '',
    house_status: '',
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('selectedCommunityId');
    if (savedId) {
      setCommunityId(parseInt(savedId));
    }

    const handleCommunityChange = (e: CustomEvent) => {
      setCommunityId(e.detail.id);
      setSelectedPhase('');
    };
    window.addEventListener('communityChanged', handleCommunityChange as EventListener);

    return () => {
      window.removeEventListener('communityChanged', handleCommunityChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (communityId) {
      loadPhases();
    }
  }, [communityId]);

  useEffect(() => {
    loadOwners();
  }, [pagination.page, search, selectedPhase, selectedWechatStatus, communityId]);

  const loadPhases = async () => {
    if (!communityId) return;
    try {
      const response = await communityApi.getPhases(communityId);
      setPhases(response.data);
    } catch (error) {
      console.error('加载期数失败:', error);
    }
  };

  const loadOwners = async () => {
    // 必须选择小区才能加载业主
    if (!communityId) {
      setOwners([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        community_id: communityId,  // 必传
      };
      if (search) params.search = search;
      if (selectedPhase) params.phase_id = selectedPhase;
      if (selectedWechatStatus) params.wechat_status = selectedWechatStatus;

      const response = await ownerApi.getAll(params);
      setOwners(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('加载业主列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleExport = () => {
    if (!communityId) {
      alert('请先选择小区');
      return;
    }

    setExporting(true);

    // 构建导出参数（与当前筛选条件一致）
    const params: any = { community_id: communityId };
    if (selectedPhase) params.phase_id = selectedPhase;
    if (search) params.search = search;
    if (selectedWechatStatus) params.wechat_status = selectedWechatStatus;

    // 获取导出 URL
    const exportUrl = ownerApi.getExportUrl(params);

    // 创建隐藏的链接并触发下载
    const link = document.createElement('a');
    link.href = exportUrl;
    // 添加 token 到 header（通过 cookie 或者使用 fetch）
    const token = localStorage.getItem('token');
    if (token) {
      // 使用 fetch 来处理需要认证的下载
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
          a.download = `业主数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  const handleImport = async () => {
    if (!importFile || !importPhaseId) {
      alert('请选择期数和文件');
      return;
    }

    try {
      setImporting(true);
      const response = await ownerApi.import(importFile, importPhaseId as number);
      setImportResult(response.data);
      loadOwners();
    } catch (error: any) {
      alert(error.response?.data?.error || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleStartEdit = (owner: Owner) => {
    setEditingId(owner.id);
    setEditForm({
      owner_name: owner.owner_name || '',
      area: owner.area,
      parking_no: owner.parking_no || '',
      parking_area: owner.parking_area,
      phone1: owner.phone1 || '',
      phone2: owner.phone2 || '',
      phone3: owner.phone3 || '',
      wechat_status: owner.wechat_status || '',
      wechat_contact: owner.wechat_contact || '',
      house_status: owner.house_status || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await ownerApi.update(editingId, editForm);
      setEditingId(null);
      setEditForm({});
      loadOwners();
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败');
    }
  };

  // 新增业主
  const handleAddOwner = async () => {
    if (!addPhaseId) {
      alert('请选择期数');
      return;
    }
    if (!addForm.building || !addForm.unit || !addForm.room) {
      alert('请填写楼栋、单元、房号');
      return;
    }

    try {
      setAdding(true);
      // 生成房间号格式: 楼栋-单元-房号
      const roomNumber = `${addForm.building}-${addForm.unit}-${addForm.room}`;
      await ownerApi.create({
        phase_id: addPhaseId,
        building: addForm.building,
        unit: addForm.unit,
        room: addForm.room,
        room_number: roomNumber,
        owner_name: addForm.owner_name || null,
        area: addForm.area ? parseFloat(addForm.area) : null,
        parking_no: addForm.parking_no || null,
        parking_area: addForm.parking_area ? parseFloat(addForm.parking_area) : null,
        phone1: addForm.phone1 || null,
        phone2: addForm.phone2 || null,
        phone3: addForm.phone3 || null,
        wechat_status: addForm.wechat_status || '',
        wechat_contact: addForm.wechat_contact || null,
        house_status: addForm.house_status || null,
      });
      setShowAddModal(false);
      setAddPhaseId('');
      setAddForm({
        building: '',
        unit: '',
        room: '',
        owner_name: '',
        area: '',
        parking_no: '',
        parking_area: '',
        phone1: '',
        phone2: '',
        phone3: '',
        wechat_status: '',
        wechat_contact: '',
        house_status: '',
      });
      loadOwners();
    } catch (error: any) {
      console.error('新增失败:', error);
      alert(error.response?.data?.error || '新增失败');
    } finally {
      setAdding(false);
    }
  };

  const columns = [
    { key: 'phase_name', header: '期数', className: 'whitespace-nowrap' },
    { key: 'room_number', header: '房间号', className: 'whitespace-nowrap' },
    {
      key: 'owner_name',
      header: '业主姓名',
      className: 'whitespace-nowrap min-w-24',
      render: (item: Owner) => editingId === item.id ? (
        <input
          type="text"
          value={editForm.owner_name || ''}
          onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 text-sm border rounded bg-white"
        />
      ) : (item.owner_name || '-'),
    },
    {
      key: 'area',
      header: '面积',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <input
          type="text"
          value={editForm.area ? String(editForm.area) : ''}
          onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-20 px-2 py-1 text-sm border rounded bg-white"
        />
      ) : (item.area ? parseFloat(String(item.area)).toFixed(2) : '-'),
    },
    {
      key: 'parking_no',
      header: '车位号',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <input
          type="text"
          value={editForm.parking_no || ''}
          onChange={(e) => setEditForm({ ...editForm, parking_no: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-20 px-2 py-1 text-sm border rounded bg-white"
        />
      ) : (item.parking_no || '-'),
    },
    {
      key: 'parking_area',
      header: '车位面积',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <input
          type="text"
          value={editForm.parking_area ? String(editForm.parking_area) : ''}
          onChange={(e) => setEditForm({ ...editForm, parking_area: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-20 px-2 py-1 text-sm border rounded bg-white"
        />
      ) : (item.parking_area ? parseFloat(String(item.parking_area)).toFixed(2) : '-'),
    },
    {
      key: 'phone1',
      header: '电话1',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <input
          type="text"
          value={editForm.phone1 || ''}
          onChange={(e) => setEditForm({ ...editForm, phone1: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-28 px-2 py-1 text-sm border rounded bg-white"
        />
      ) : (item.phone1 || '-'),
    },
    {
      key: 'phone2',
      header: '电话2',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <input
          type="text"
          value={editForm.phone2 || ''}
          onChange={(e) => setEditForm({ ...editForm, phone2: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-28 px-2 py-1 text-sm border rounded bg-white"
        />
      ) : (item.phone2 || '-'),
    },
    {
      key: 'phone3',
      header: '电话3',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <input
          type="text"
          value={editForm.phone3 || ''}
          onChange={(e) => setEditForm({ ...editForm, phone3: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-28 px-2 py-1 text-sm border rounded bg-white"
        />
      ) : (item.phone3 || '-'),
    },
    {
      key: 'wechat_status',
      header: '微信状态',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <select
          value={editForm.wechat_status || ''}
          onChange={(e) => setEditForm({ ...editForm, wechat_status: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-1 text-xs border rounded cursor-pointer bg-white"
        >
          <option value="">未添加</option>
          <option value="已加微信">已加微信</option>
          <option value="无法添加">无法添加</option>
        </select>
      ) : (
        <span className={cn('px-2 py-0.5 rounded-full text-xs', wechatStatusMap[item.wechat_status || '']?.color || wechatStatusMap[''].color)}>
          {wechatStatusMap[item.wechat_status || '']?.label || '未添加'}
        </span>
      ),
    },
    {
      key: 'wechat_contact',
      header: '微信沟通人',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <input
          type="text"
          value={editForm.wechat_contact || ''}
          onChange={(e) => setEditForm({ ...editForm, wechat_contact: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-24 px-2 py-1 text-sm border rounded bg-white"
        />
      ) : (item.wechat_contact || '-'),
    },
    {
      key: 'house_status',
      header: '房屋状态',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <select
          value={editForm.house_status || ''}
          onChange={(e) => setEditForm({ ...editForm, house_status: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-1 text-xs border rounded cursor-pointer bg-white"
        >
          <option value="">未知</option>
          <option value="业主自住">业主自住</option>
          <option value="个人租户">个人租户</option>
          <option value="中介租户">中介租户</option>
          <option value="业主亲友">业主亲友</option>
          <option value="空置">空置</option>
          <option value="已卖房">已卖房</option>
        </select>
      ) : (item.house_status || '-'),
    },
    {
      key: 'actions',
      header: '操作',
      className: 'whitespace-nowrap',
      render: (item: Owner) => editingId === item.id ? (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="保存"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
            className="p-1 text-slate-600 hover:bg-slate-50 rounded"
            title="取消"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); handleStartEdit(item); }}
          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
          title="编辑"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">业主管理</h1>
            <p className="text-slate-500 mt-0.5">管理业主基本信息</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!communityId}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            新增业主
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !communityId}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            导出 Excel
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 transition-all duration-200 font-medium"
          >
            <Upload className="w-4 h-4" />
            导入 Excel
          </button>
        </div>
      </div>

      {/* 搜索和筛选 */}
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
                placeholder="搜索房间号、姓名、电话..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* 期数筛选 */}
          <select
            value={selectedPhase}
            onChange={(e) => setSelectedPhase(e.target.value ? parseInt(e.target.value) : '')}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
          >
            <option value="">全部期数</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </select>

          {/* 微信状态筛选 */}
          <select
            value={selectedWechatStatus}
            onChange={(e) => setSelectedWechatStatus(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
          >
            <option value="">全部微信状态</option>
            <option value="已加微信">已加微信</option>
            <option value="无法添加">无法添加</option>
            <option value="">未添加</option>
          </select>

          <button
            onClick={handleSearch}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/20 transition-all duration-200 font-medium"
          >
            搜索
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={owners}
        loading={loading}
        pagination={pagination}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
      />

      {/* 导入弹窗 */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <FileSpreadsheet className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">导入业主数据</h2>
                </div>
                <button
                  onClick={() => {
                    setShowImport(false);
                    setImportResult(null);
                    setImportFile(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {!importResult ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      选择期数
                    </label>
                    <select
                      value={importPhaseId}
                      onChange={(e) => setImportPhaseId(parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    >
                      <option value="">请选择期数</option>
                      {phases.map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {phase.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      选择 Excel 文件
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100 cursor-pointer transition-colors"
                      />
                    </div>
                    {importFile && (
                      <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
                        <Check className="w-4 h-4" /> 已选择: {importFile.name}
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-sm font-medium text-amber-800 mb-1">Excel 文件格式说明</p>
                    <p className="text-xs text-amber-700">
                      需包含列：序号、房间号、姓名、面积、车位号、车位面积、联系电话1、联系电话2、联系电话3、群状态、微信沟通人、房屋状态
                    </p>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={importing || !importFile || !importPhaseId}
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        导入中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        开始导入
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="font-medium text-emerald-800">{importResult.message}</p>
                    </div>
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                      <p className="font-medium text-red-800 mb-2">部分数据导入失败：</p>
                      <ul className="text-sm text-red-700 list-disc pl-4 space-y-1">
                        {importResult.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowImport(false);
                      setImportResult(null);
                      setImportFile(null);
                    }}
                    className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium"
                  >
                    关闭
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 新增业主弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* 弹窗头部 */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">新增业主</h2>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setAddPhaseId('');
                    setAddForm({
                      building: '',
                      unit: '',
                      room: '',
                      owner_name: '',
                      area: '',
                      parking_no: '',
                      parking_area: '',
                      phone1: '',
                      phone2: '',
                      phone3: '',
                      wechat_status: '',
                      wechat_contact: '',
                      house_status: '',
                    });
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* 期数选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  选择期数 <span className="text-red-500">*</span>
                </label>
                <select
                  value={addPhaseId}
                  onChange={(e) => setAddPhaseId(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                >
                  <option value="">请选择期数</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 房间信息 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    楼栋 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.building}
                    onChange={(e) => setAddForm({ ...addForm, building: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="如：01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    单元 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.unit}
                    onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="如：01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    房号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.room}
                    onChange={(e) => setAddForm({ ...addForm, room: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="如：0101"
                  />
                </div>
              </div>

              {/* 业主信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    业主姓名
                  </label>
                  <input
                    type="text"
                    value={addForm.owner_name}
                    onChange={(e) => setAddForm({ ...addForm, owner_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    面积 (m²)
                  </label>
                  <input
                    type="text"
                    value={addForm.area}
                    onChange={(e) => setAddForm({ ...addForm, area: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="如：120.5"
                  />
                </div>
              </div>

              {/* 车位信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    车位号
                  </label>
                  <input
                    type="text"
                    value={addForm.parking_no}
                    onChange={(e) => setAddForm({ ...addForm, parking_no: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="车位号"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    车位面积 (m²)
                  </label>
                  <input
                    type="text"
                    value={addForm.parking_area}
                    onChange={(e) => setAddForm({ ...addForm, parking_area: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="如：12.5"
                  />
                </div>
              </div>

              {/* 联系电话 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    联系电话1
                  </label>
                  <input
                    type="text"
                    value={addForm.phone1}
                    onChange={(e) => setAddForm({ ...addForm, phone1: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="电话"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    联系电话2
                  </label>
                  <input
                    type="text"
                    value={addForm.phone2}
                    onChange={(e) => setAddForm({ ...addForm, phone2: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="电话"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    联系电话3
                  </label>
                  <input
                    type="text"
                    value={addForm.phone3}
                    onChange={(e) => setAddForm({ ...addForm, phone3: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="电话"
                  />
                </div>
              </div>

              {/* 微信和房屋状态 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    微信状态
                  </label>
                  <select
                    value={addForm.wechat_status}
                    onChange={(e) => setAddForm({ ...addForm, wechat_status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
                  >
                    <option value="">未添加</option>
                    <option value="已加微信">已加微信</option>
                    <option value="无法添加">无法添加</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    微信沟通人
                  </label>
                  <input
                    type="text"
                    value={addForm.wechat_contact}
                    onChange={(e) => setAddForm({ ...addForm, wechat_contact: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200"
                    placeholder="沟通人"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    房屋状态
                  </label>
                  <select
                    value={addForm.house_status}
                    onChange={(e) => setAddForm({ ...addForm, house_status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all duration-200 cursor-pointer"
                  >
                    <option value="">未知</option>
                    <option value="业主自住">业主自住</option>
                    <option value="个人租户">个人租户</option>
                    <option value="中介租户">中介租户</option>
                    <option value="业主亲友">业主亲友</option>
                    <option value="空置">空置</option>
                    <option value="已卖房">已卖房</option>
                  </select>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setAddPhaseId('');
                    setAddForm({
                      building: '',
                      unit: '',
                      room: '',
                      owner_name: '',
                      area: '',
                      parking_no: '',
                      parking_area: '',
                      phone1: '',
                      phone2: '',
                      phone3: '',
                      wechat_status: '',
                      wechat_contact: '',
                      house_status: '',
                    });
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleAddOwner}
                  disabled={adding}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                  {adding ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
