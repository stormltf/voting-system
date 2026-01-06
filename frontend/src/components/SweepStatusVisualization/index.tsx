'use client';

import { useState, useEffect, useCallback } from 'react';
import { Footprints, Loader2, ChevronDown, ChevronRight, X, CheckSquare, Square } from 'lucide-react';
import SweepFloorGrid from './SweepFloorGrid';
import SweepEditModal from './SweepEditModal';
import { voteApi } from '@/lib/api';
import {
  SweepUnitRoomsResponse,
  SweepRoomData,
  SweepOverviewResponse,
  SweepPhaseStats,
  Round,
} from './types';

interface Props {
  communityId: number | null;
}

export default function SweepStatusVisualization({ communityId }: Props) {
  // 数据状态
  const [overviewData, setOverviewData] = useState<SweepOverviewResponse | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);

  // 详情弹窗状态
  const [selectedUnit, setSelectedUnit] = useState<{
    phaseId: number;
    phaseName: string;
    building: string;
    unit: string;
  } | null>(null);
  const [roomData, setRoomData] = useState<SweepUnitRoomsResponse | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [editingRoom, setEditingRoom] = useState<SweepRoomData | null>(null);

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  // 批量选择状态
  const [batchMode, setBatchMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [batchUpdating, setBatchUpdating] = useState(false);

  // 加载投票轮次列表
  useEffect(() => {
    if (!communityId) return;

    const loadRounds = async () => {
      try {
        const res = await voteApi.getRounds({ community_id: communityId });
        setRounds(res.data);
      } catch (error) {
        console.error('加载投票轮次失败:', error);
      }
    };

    loadRounds();
  }, [communityId]);

  // 加载扫楼概览数据
  const loadOverview = useCallback(async () => {
    if (!communityId) return;

    try {
      setLoading(true);
      const params: { community_id: number; round_id?: number } = {
        community_id: communityId,
      };
      if (selectedRoundId) {
        params.round_id = selectedRoundId;
      }

      const res = await voteApi.getSweepOverview(params);
      setOverviewData(res.data);

      // 默认展开所有期数
      if (res.data.phases) {
        setExpandedPhases(new Set(res.data.phases.map((p: SweepPhaseStats) => p.phase_id)));
      }

      // 如果没有选择轮次，从返回数据中获取默认轮次
      if (!selectedRoundId && res.data.round) {
        setSelectedRoundId(res.data.round.id);
      }
    } catch (error) {
      console.error('加载扫楼概览失败:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId, selectedRoundId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // 加载单元详情
  const loadUnitDetail = useCallback(async () => {
    if (!selectedUnit || !overviewData?.round) return;

    try {
      setLoadingRooms(true);
      const res = await voteApi.getSweepUnitRooms({
        round_id: overviewData.round.id,
        phase_id: selectedUnit.phaseId,
        building: selectedUnit.building,
        unit: selectedUnit.unit,
      });
      setRoomData(res.data);
    } catch (error) {
      console.error('加载房间数据失败:', error);
      setRoomData(null);
    } finally {
      setLoadingRooms(false);
    }
  }, [selectedUnit, overviewData?.round]);

  useEffect(() => {
    loadUnitDetail();
  }, [loadUnitDetail]);

  // 切换期数展开/折叠
  const togglePhase = (phaseId: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  // 点击单元格
  const handleUnitClick = (phaseId: number, phaseName: string, building: string, unit: string) => {
    setSelectedUnit({ phaseId, phaseName, building, unit });
  };

  // 关闭详情弹窗
  const closeDetail = () => {
    setSelectedUnit(null);
    setRoomData(null);
    setBatchMode(false);
    setSelectedRooms(new Set());
  };

  // 切换批量选择模式
  const toggleBatchMode = () => {
    setBatchMode(!batchMode);
    setSelectedRooms(new Set());
  };

  // 处理房间选择
  const handleSelectRoom = (ownerId: number, selected: boolean) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(ownerId);
      } else {
        next.delete(ownerId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (!roomData) return;
    const allRoomIds = Object.values(roomData.floors)
      .flat()
      .map((room) => room.owner_id);
    if (selectedRooms.size === allRoomIds.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(allRoomIds));
    }
  };

  // 批量更新扫楼状态
  const handleBatchUpdateSweep = async (sweepStatus: string) => {
    if (!communityId || !overviewData?.round || selectedRooms.size === 0) return;

    try {
      setBatchUpdating(true);
      await voteApi.batchUpdateSweep({
        owner_ids: Array.from(selectedRooms),
        round_id: overviewData.round.id,
        sweep_status: sweepStatus,
        community_id: communityId,
      });
      // 刷新数据
      await loadUnitDetail();
      await loadOverview();
      setSelectedRooms(new Set());
      setBatchMode(false);
    } catch (error) {
      console.error('批量更新失败:', error);
    } finally {
      setBatchUpdating(false);
    }
  };

  // 计算完成率
  const getCompletedPercent = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-emerald-500';
    if (percent >= 50) return 'bg-blue-500';
    if (percent >= 30) return 'bg-amber-500';
    return 'bg-zinc-300';
  };

  if (!communityId) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200/80 p-8 text-center text-[13px] text-zinc-400">
        请先选择小区
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200/80 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className="w-4 h-4 text-zinc-400" />
            <h2 className="text-[15px] font-medium text-zinc-900">扫楼进度管理</h2>
            {overviewData?.round && (
              <span className="text-[13px] text-zinc-400 ml-1">
                · {overviewData.round.name}
                {overviewData.round.status === 'active' && (
                  <span className="text-emerald-600 ml-1">进行中</span>
                )}
              </span>
            )}
          </div>

          {rounds.length > 0 && (
            <div className="relative">
              <select
                value={selectedRoundId ?? ''}
                onChange={(e) => setSelectedRoundId(e.target.value ? Number(e.target.value) : null)}
                className="appearance-none px-3 py-1.5 pr-8 bg-white border border-zinc-200 rounded-lg text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none cursor-pointer"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.status === 'active' ? ' (进行中)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-10 flex flex-col items-center justify-center text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <span className="text-[13px]">加载中...</span>
        </div>
      ) : !overviewData?.phases?.length ? (
        <div className="p-10 text-center text-[13px] text-zinc-400">暂无楼栋数据</div>
      ) : (
        <div className="p-4 space-y-3">
          {overviewData.phases.map((phase) => (
            <div key={phase.phase_id} className="border border-zinc-200/80 rounded-lg overflow-hidden">
              <button
                onClick={() => togglePhase(phase.phase_id)}
                className="w-full px-4 py-3 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {expandedPhases.has(phase.phase_id) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span className="text-[14px] font-medium text-zinc-800">{phase.phase_name}</span>
                  <span className="text-[12px] text-zinc-400">
                    {phase.buildings.length} 栋 · {phase.total_rooms} 户
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(getCompletedPercent(phase.completed_count, phase.total_rooms))} transition-all`}
                        style={{ width: `${getCompletedPercent(phase.completed_count, phase.total_rooms)}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-medium text-zinc-500">
                      {getCompletedPercent(phase.completed_count, phase.total_rooms)}%
                    </span>
                  </div>
                  <div className="text-[12px] text-zinc-400">
                    <span className="text-emerald-600 font-medium">{phase.completed_count}</span>
                    <span className="mx-0.5">/</span>
                    <span>{phase.total_rooms}</span>
                  </div>
                </div>
              </button>

              {expandedPhases.has(phase.phase_id) && (
                <div className="p-3 space-y-2">
                  {phase.buildings.map((building) => (
                    <div key={building.building} className="bg-zinc-50/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-medium text-zinc-700">{building.building}号楼</span>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-600">{building.completed_count} 已完成</span>
                          <span className="text-amber-500">{building.in_progress_count} 进行中</span>
                          <span className="text-zinc-400">{building.pending_count} 待扫楼</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {building.units.map((unit) => {
                          const percent = getCompletedPercent(unit.completed_count, unit.total_rooms);
                          return (
                            <button
                              key={unit.unit}
                              onClick={() =>
                                handleUnitClick(phase.phase_id, phase.phase_name, building.building, unit.unit)
                              }
                              className="group relative flex flex-col items-center px-2.5 py-1.5 bg-white border border-zinc-200 rounded-md hover:border-blue-400 transition-colors min-w-[72px]"
                            >
                              <span className="text-[12px] font-medium text-zinc-700">{unit.unit}单元</span>
                              <div className="w-full h-1 bg-zinc-200 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full ${getProgressColor(percent)} transition-all`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-zinc-400 mt-0.5">
                                {percent}% ({unit.completed_count}/{unit.total_rooms})
                              </span>

                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                已完成 {unit.completed_count} · 进行中 {unit.in_progress_count} · 待扫楼{' '}
                                {unit.pending_count}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedUnit && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-medium text-zinc-900">
                  {selectedUnit.phaseName} · {selectedUnit.building}号楼 · {selectedUnit.unit}单元
                </h3>
                {overviewData?.round && (
                  <p className="text-[12px] text-zinc-400 mt-0.5">{overviewData.round.name} - 扫楼进度</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleBatchMode}
                  className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                    batchMode
                      ? 'bg-amber-500 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  批量操作
                </button>
                <button
                  onClick={closeDetail}
                  className="p-1.5 hover:bg-zinc-100 rounded-md transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            </div>

            {batchMode && (
              <div className="px-5 py-2.5 bg-amber-50/50 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-[12px] text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    {roomData && selectedRooms.size === Object.values(roomData.floors).flat().length ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" />
                        取消全选
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        全选
                      </>
                    )}
                  </button>
                  <span className="text-[12px] text-zinc-500">
                    已选择 <span className="font-medium text-amber-600">{selectedRooms.size}</span> 户
                  </span>
                </div>
                {selectedRooms.size > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-zinc-400 mr-1">设置状态:</span>
                    <button
                      onClick={() => handleBatchUpdateSweep('completed')}
                      disabled={batchUpdating}
                      className="px-2.5 py-1 text-[11px] font-medium bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      已完成
                    </button>
                    <button
                      onClick={() => handleBatchUpdateSweep('in_progress')}
                      disabled={batchUpdating}
                      className="px-2.5 py-1 text-[11px] font-medium bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      进行中
                    </button>
                    <button
                      onClick={() => handleBatchUpdateSweep('pending')}
                      disabled={batchUpdating}
                      className="px-2.5 py-1 text-[11px] font-medium bg-zinc-300 text-zinc-600 rounded-md hover:bg-zinc-400 disabled:opacity-50 transition-colors"
                    >
                      待扫楼
                    </button>
                    {batchUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {loadingRooms ? (
                <div className="p-10 flex flex-col items-center justify-center text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-[13px]">加载中...</span>
                </div>
              ) : roomData && roomData.meta.total_rooms > 0 ? (
                <SweepFloorGrid
                  data={roomData}
                  onRoomClick={setEditingRoom}
                  selectable={batchMode}
                  selectedRooms={selectedRooms}
                  onSelectRoom={handleSelectRoom}
                />
              ) : (
                <div className="p-10 text-center text-[13px] text-zinc-400">该单元没有房间数据</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 房间编辑弹窗 */}
      {editingRoom && overviewData?.round && (
        <SweepEditModal
          room={editingRoom}
          roundId={overviewData.round.id}
          onClose={() => setEditingRoom(null)}
          onSaved={() => {
            loadUnitDetail();
            loadOverview();
          }}
        />
      )}
    </div>
  );
}
