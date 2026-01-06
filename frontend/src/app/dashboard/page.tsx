'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Home, Vote, TrendingUp, Building, Loader2, BarChart3 } from 'lucide-react';
import StatsCard from '@/components/StatsCard';
import BuildingVoteVisualization from '@/components/BuildingVoteVisualization';
import SweepStatusVisualization from '@/components/SweepStatusVisualization';
import { voteApi } from '@/lib/api';
import { formatNumber, formatArea, formatPercent } from '@/lib/utils';

interface VoteProgress {
  round_id: number;
  round_name: string;
  year: number;
  round_code: string;
  status: string;
  total_owners: number;
  voted_count: number;
  total_area: number;
  total_parking_area: number;
  voted_area: number;
  voted_parking_area: number;
}

interface PhaseStats {
  phase_id: number;
  phase_name: string;
  community_name: string;
  owner_count: number;
  total_area: number;
  total_parking_area: number;
  voted_count: number;
  voted_area: number;
  voted_parking_area: number;
}

export default function DashboardPage() {
  const [progress, setProgress] = useState<VoteProgress[]>([]);
  const [phaseStats, setPhaseStats] = useState<PhaseStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [communityId, setCommunityId] = useState<number | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const savedId = localStorage.getItem('selectedCommunityId');
    if (savedId) {
      setCommunityId(parseInt(savedId));
    }
    setInitialized(true);

    const handleCommunityChange = (e: CustomEvent) => {
      const newId = e.detail.id;
      setCommunityId(newId);
      // 即使选择同一个小区，也强制刷新数据
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('communityChanged', handleCommunityChange as EventListener);

    return () => {
      window.removeEventListener('communityChanged', handleCommunityChange as EventListener);
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = communityId ? { community_id: communityId } : {};

      const progressRes = await voteApi.getProgress(params);
      setProgress(progressRes.data);

      const activeRoundData = progressRes.data.find((r: VoteProgress) => r.status === 'active');
      const statsParams = {
        ...params,
        ...(activeRoundData ? { round_id: activeRoundData.round_id } : {}),
      };

      const statsRes = await voteApi.getStats(statsParams);
      setPhaseStats(statsRes.data.phaseStats || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (initialized) {
      loadData();
    }
  }, [communityId, initialized, refreshKey, loadData]);

  const activeRound = progress.find((r) => r.status === 'active');

  // 优先从 activeRound 获取总数，否则从 phaseStats 累加
  const totalOwners = activeRound?.total_owners || phaseStats.reduce((sum, p) => sum + (p.owner_count || 0), 0);
  const totalHouseArea = activeRound
    ? parseFloat(String(activeRound.total_area || 0))
    : phaseStats.reduce((sum, p) => sum + parseFloat(String(p.total_area || 0)), 0);
  const totalParkingArea = activeRound
    ? parseFloat(String(activeRound.total_parking_area || 0))
    : phaseStats.reduce((sum, p) => sum + parseFloat(String(p.total_parking_area || 0)), 0);
  const totalArea = totalHouseArea + totalParkingArea;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          <span className="text-[13px] text-zinc-400">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">仪表盘</h1>
        <p className="text-[13px] text-zinc-500">投票数据概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="总业主数"
          value={formatNumber(totalOwners)}
          subtitle="户"
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="总面积"
          value={formatArea(totalArea)}
          subtitle={`房屋 ${formatArea(totalHouseArea)} / 车位 ${formatArea(totalParkingArea)}`}
          icon={Home}
          color="green"
        />
        {activeRound && (
          <>
            <StatsCard
              title={`${activeRound.round_name} 已投票`}
              value={formatNumber(activeRound.voted_count)}
              subtitle={`投票率 ${formatPercent(activeRound.voted_count, activeRound.total_owners)}`}
              icon={Vote}
              color="purple"
            />
            <StatsCard
              title="面积投票率"
              value={formatPercent(activeRound.voted_area, activeRound.total_area)}
              subtitle={`已投票面积 ${formatArea(activeRound.voted_area)}`}
              icon={TrendingUp}
              color="yellow"
            />
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-zinc-400" />
            <h2 className="text-[15px] font-medium text-zinc-900">各期统计</h2>
            {activeRound && (
              <span className="text-[13px] text-zinc-400 ml-1">
                · {activeRound.round_name}
              </span>
            )}
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {phaseStats.map((phase) => {
              const phaseHouseArea = parseFloat(String(phase.total_area || 0));
              const phaseParkingArea = parseFloat(String(phase.total_parking_area || 0));
              const phaseTotalArea = phaseHouseArea + phaseParkingArea;
              const phaseVotedHouseArea = parseFloat(String(phase.voted_area || 0));
              const phaseVotedParkingArea = parseFloat(String(phase.voted_parking_area || 0));
              const phaseVotedTotalArea = phaseVotedHouseArea + phaseVotedParkingArea;
              const votePercentage = phase.owner_count > 0
                ? ((phase.voted_count || 0) / phase.owner_count) * 100
                : 0;
              const areaVotePercentage = phaseTotalArea > 0
                ? (phaseVotedTotalArea / phaseTotalArea) * 100
                : 0;

              return (
                <div
                  key={phase.phase_id}
                  className="group bg-zinc-50/50 border border-zinc-200/60 rounded-lg p-4 hover:border-zinc-300 transition-colors duration-200"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-md bg-zinc-900 flex items-center justify-center">
                      <Building className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-[14px] font-medium text-zinc-900">{phase.phase_name}</h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-zinc-500">业主数</span>
                      <span className="text-[14px] font-semibold text-zinc-900">{formatNumber(phase.owner_count)} <span className="text-[12px] font-normal text-zinc-400">户</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-zinc-500">总面积</span>
                      <span className="text-[13px] font-medium text-zinc-700">{formatArea(phaseTotalArea)}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 text-right">
                      房屋 {formatArea(phaseHouseArea)} / 车位 {formatArea(phaseParkingArea)}
                    </div>
                  </div>

                  {activeRound && (
                    <div className="mt-3 pt-3 border-t border-zinc-200/60 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] text-zinc-500">已投票</span>
                        <span className="text-[13px] font-semibold text-emerald-600">
                          {phase.voted_count || 0} <span className="font-normal">户</span>
                          <span className="text-[11px] text-zinc-400 ml-1">({votePercentage.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="relative h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${votePercentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] text-zinc-500">已投面积</span>
                        <span className="text-[13px] font-medium text-emerald-600">
                          {formatArea(phaseVotedTotalArea)}
                          <span className="text-[11px] text-zinc-400 ml-1">({areaVotePercentage.toFixed(1)}%)</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {phaseStats.length === 0 && (
              <div className="col-span-full flex flex-col items-center py-10">
                <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center mb-2">
                  <Building className="w-5 h-5 text-zinc-400" />
                </div>
                <p className="text-[13px] text-zinc-400">暂无期数数据</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 楼栋投票状态可视化 */}
      <BuildingVoteVisualization communityId={communityId} />

      {/* 扫楼进度管理 */}
      <SweepStatusVisualization communityId={communityId} />

      <div className="bg-white rounded-xl border border-zinc-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            <h2 className="text-[15px] font-medium text-zinc-900">各轮投票进度</h2>
          </div>
        </div>
        <div className="p-5">
          <div className="space-y-3">
            {progress.map((round) => {
              const percentage = round.total_owners > 0
                ? (round.voted_count / round.total_owners) * 100
                : 0;
              const roundTotalArea = parseFloat(String(round.total_area || 0)) + parseFloat(String(round.total_parking_area || 0));
              const roundVotedArea = parseFloat(String(round.voted_area || 0)) + parseFloat(String(round.voted_parking_area || 0));
              const areaPercentage = roundTotalArea > 0
                ? (roundVotedArea / roundTotalArea) * 100
                : 0;

              const isActive = round.status === 'active';

              return (
                <div
                  key={round.round_id}
                  className={`p-4 rounded-lg border transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-50/50 border-blue-200'
                      : 'bg-zinc-50/50 border-zinc-200/60 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[14px] font-medium ${isActive ? 'text-zinc-900' : 'text-zinc-700'}`}>
                        {round.round_name}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : round.status === 'closed'
                            ? 'bg-zinc-200 text-zinc-600'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isActive ? '进行中' : round.status === 'closed' ? '已结束' : '草稿'}
                      </span>
                    </div>
                    <div className={`text-[13px] ${isActive ? 'text-zinc-700' : 'text-zinc-500'}`}>
                      <span className="font-medium">{round.voted_count}</span> / {round.total_owners} 户
                      <span className="ml-1.5 text-[11px] text-zinc-400">({percentage.toFixed(1)}%)</span>
                    </div>
                  </div>

                  <div className="relative h-1.5 bg-white rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
                        isActive
                          ? 'bg-blue-500'
                          : 'bg-zinc-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="flex justify-between mt-2 text-[11px] text-zinc-400">
                    <span>面积投票率: <span className="font-medium text-zinc-500">{areaPercentage.toFixed(1)}%</span> · 总面积 {formatArea(roundTotalArea)}</span>
                    <span>已投票面积: <span className="font-medium text-zinc-500">{formatArea(roundVotedArea)}</span></span>
                  </div>
                </div>
              );
            })}
            {progress.length === 0 && (
              <div className="flex flex-col items-center py-10">
                <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center mb-2">
                  <Vote className="w-5 h-5 text-zinc-400" />
                </div>
                <p className="text-[13px] text-zinc-400">暂无投票轮次</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
