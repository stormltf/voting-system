'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Loader2, ChevronDown, ChevronRight, X } from 'lucide-react';
import FloorGrid from './FloorGrid';
import RoomEditModal from './RoomEditModal';
import { voteApi } from '@/lib/api';
import {
  UnitRoomsResponse,
  RoomData,
  Round,
  BuildingOverviewResponse,
  PhaseStats,
} from './types';

interface Props {
  communityId: number | null;
}

export default function BuildingVoteVisualization({ communityId }: Props) {
  // 数据状态
  const [overviewData, setOverviewData] = useState<BuildingOverviewResponse | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);

  // 详情弹窗状态
  const [selectedUnit, setSelectedUnit] = useState<{
    phaseId: number;
    phaseName: string;
    building: string;
    unit: string;
  } | null>(null);
  const [roomData, setRoomData] = useState<UnitRoomsResponse | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomData | null>(null);

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

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

  // 加载楼栋概览数据
  useEffect(() => {
    if (!communityId) return;

    const loadOverview = async () => {
      try {
        setLoading(true);
        const params: { community_id: number; round_id?: number } = {
          community_id: communityId,
        };
        if (selectedRoundId) {
          params.round_id = selectedRoundId;
        }

        const res = await voteApi.getBuildingOverview(params);
        setOverviewData(res.data);

        // 默认展开所有期数
        if (res.data.phases) {
          setExpandedPhases(new Set(res.data.phases.map((p: PhaseStats) => p.phase_id)));
        }

        // 如果没有选择轮次，从返回数据中获取默认轮次
        if (!selectedRoundId && res.data.round) {
          setSelectedRoundId(res.data.round.id);
        }
      } catch (error) {
        console.error('加载楼栋概览失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [communityId, selectedRoundId]);

  // 加载单元详情
  const loadUnitDetail = useCallback(async () => {
    if (!selectedUnit || !overviewData?.round) return;

    try {
      setLoadingRooms(true);
      const res = await voteApi.getUnitRooms({
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
  };

  // 计算投票率
  const getVotePercent = (voted: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((voted / total) * 100);
  };

  // 获取进度条颜色
  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-emerald-500';
    if (percent >= 50) return 'bg-blue-500';
    if (percent >= 30) return 'bg-amber-500';
    return 'bg-slate-300';
  };

  if (!communityId) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 text-center text-slate-500">
        请先选择小区
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      {/* 标题和轮次选择 */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">楼栋投票状态</h2>
            {overviewData?.round && (
              <span className="text-sm text-slate-500 ml-2">
                （{overviewData.round.name}
                {overviewData.round.status === 'active' && (
                  <span className="text-emerald-600 ml-1">进行中</span>
                )}
                ）
              </span>
            )}
          </div>

          {/* 轮次选择 */}
          {rounds.length > 0 && (
            <div className="relative">
              <select
                value={selectedRoundId ?? ''}
                onChange={(e) => setSelectedRoundId(e.target.value ? Number(e.target.value) : null)}
                className="appearance-none px-3 py-1.5 pr-8 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.status === 'active' ? ' (进行中)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span>加载中...</span>
        </div>
      ) : !overviewData?.phases?.length ? (
        <div className="p-12 text-center text-slate-400">暂无楼栋数据</div>
      ) : (
        <div className="p-4 space-y-4">
          {overviewData.phases.map((phase) => (
            <div key={phase.phase_id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* 期数标题 */}
              <button
                onClick={() => togglePhase(phase.phase_id)}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedPhases.has(phase.phase_id) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="font-semibold text-slate-800">{phase.phase_name}</span>
                  <span className="text-sm text-slate-500">
                    {phase.buildings.length} 栋 · {phase.total_rooms} 户
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(getVotePercent(phase.voted_count, phase.total_rooms))} transition-all`}
                        style={{ width: `${getVotePercent(phase.voted_count, phase.total_rooms)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      {getVotePercent(phase.voted_count, phase.total_rooms)}%
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    <span className="text-emerald-600 font-medium">{phase.voted_count}</span>
                    <span className="mx-1">/</span>
                    <span>{phase.total_rooms}</span>
                  </div>
                </div>
              </button>

              {/* 楼栋列表 */}
              {expandedPhases.has(phase.phase_id) && (
                <div className="p-4 space-y-3">
                  {phase.buildings.map((building) => (
                    <div key={building.building} className="bg-slate-50/50 rounded-lg p-3">
                      {/* 楼栋标题 */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-700">{building.building}号楼</span>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-emerald-600">{building.voted_count} 已投</span>
                          <span className="text-red-500">{building.refused_count} 拒绝</span>
                          <span className="text-slate-400">{building.pending_count} 待投</span>
                        </div>
                      </div>

                      {/* 单元格子 */}
                      <div className="flex flex-wrap gap-2">
                        {building.units.map((unit) => {
                          const percent = getVotePercent(unit.voted_count, unit.total_rooms);
                          return (
                            <button
                              key={unit.unit}
                              onClick={() =>
                                handleUnitClick(phase.phase_id, phase.phase_name, building.building, unit.unit)
                              }
                              className="group relative flex flex-col items-center px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all min-w-[80px]"
                            >
                              <span className="text-sm font-medium text-slate-700">{unit.unit}单元</span>
                              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                                <div
                                  className={`h-full ${getProgressColor(percent)} transition-all`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 mt-1">
                                {unit.voted_count}/{unit.total_rooms}
                              </span>

                              {/* Hover 提示 */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                已投 {unit.voted_count} · 拒绝 {unit.refused_count} · 待投 {unit.pending_count}
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

      {/* 单元详情弹窗 */}
      {selectedUnit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 弹窗标题 */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedUnit.phaseName} · {selectedUnit.building}号楼 · {selectedUnit.unit}单元
                </h3>
                {overviewData?.round && (
                  <p className="text-sm text-slate-500 mt-0.5">{overviewData.round.name}</p>
                )}
              </div>
              <button
                onClick={closeDetail}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-auto">
              {loadingRooms ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span>加载中...</span>
                </div>
              ) : roomData && roomData.meta.total_rooms > 0 ? (
                <FloorGrid data={roomData} onRoomClick={setEditingRoom} />
              ) : (
                <div className="p-12 text-center text-slate-400">该单元没有房间数据</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 房间编辑弹窗 */}
      {editingRoom && overviewData?.round && (
        <RoomEditModal
          room={editingRoom}
          roundId={overviewData.round.id}
          onClose={() => setEditingRoom(null)}
          onSaved={() => {
            loadUnitDetail();
          }}
        />
      )}
    </div>
  );
}
