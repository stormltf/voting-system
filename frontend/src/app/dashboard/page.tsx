'use client';

import { useState, useEffect } from 'react';
import { Users, Home, Vote, TrendingUp, Building, Loader2, BarChart3 } from 'lucide-react';
import StatsCard from '@/components/StatsCard';
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

  useEffect(() => {
    const savedId = localStorage.getItem('selectedCommunityId');
    if (savedId) {
      setCommunityId(parseInt(savedId));
    }
    setInitialized(true);

    const handleCommunityChange = (e: CustomEvent) => {
      setCommunityId(e.detail.id);
    };
    window.addEventListener('communityChanged', handleCommunityChange as EventListener);

    return () => {
      window.removeEventListener('communityChanged', handleCommunityChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (initialized) {
      loadData();
    }
  }, [communityId, initialized]);

  const loadData = async () => {
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
  };

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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-slate-500">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">仪表盘</h1>
        <p className="text-slate-500 mt-1">投票数据概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* 各期统计 */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">各期统计</h2>
            {activeRound && (
              <span className="text-sm font-normal text-slate-500 ml-2">
                （{activeRound.round_name} 投票数据）
              </span>
            )}
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                  className="group relative bg-gradient-to-br from-slate-50 to-white border border-slate-200/60 rounded-xl p-5 hover:shadow-md hover:border-slate-300/60 transition-all duration-300"
                >
                  {/* 装饰 */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/5 to-transparent rounded-bl-full" />

                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Building className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-slate-900">{phase.phase_name}</h3>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">业主数</span>
                        <span className="text-lg font-bold text-slate-900">{formatNumber(phase.owner_count)} <span className="text-sm font-normal text-slate-400">户</span></span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">总面积</span>
                        <span className="font-semibold text-slate-700">{formatArea(phaseTotalArea)}</span>
                      </div>
                      <div className="text-xs text-slate-400 text-right">
                        房屋 {formatArea(phaseHouseArea)} / 车位 {formatArea(phaseParkingArea)}
                      </div>
                    </div>

                    {activeRound && (
                      <div className="mt-4 pt-4 border-t border-slate-200/60 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">已投票</span>
                          <span className="font-bold text-emerald-600">
                            {phase.voted_count || 0} <span className="text-sm font-normal">户</span>
                            <span className="text-xs text-slate-400 ml-1">({votePercentage.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${votePercentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">已投面积</span>
                          <span className="font-semibold text-emerald-600">
                            {formatArea(phaseVotedTotalArea)}
                            <span className="text-xs text-slate-400 ml-1">({areaVotePercentage.toFixed(1)}%)</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {phaseStats.length === 0 && (
              <div className="col-span-full flex flex-col items-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Building className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">暂无期数数据</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 各轮投票进度 */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">各轮投票进度</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-6">
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
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                      : 'bg-slate-50/50 border-slate-200/60 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>
                        {round.round_name}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : round.status === 'closed'
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isActive ? '进行中' : round.status === 'closed' ? '已结束' : '草稿'}
                      </span>
                    </div>
                    <div className={`text-sm ${isActive ? 'text-blue-700' : 'text-slate-600'}`}>
                      <span className="font-semibold">{round.voted_count}</span> / {round.total_owners} 户
                      <span className="ml-2 text-xs">({percentage.toFixed(1)}%)</span>
                    </div>
                  </div>

                  <div className="relative h-3 bg-white/80 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                          : 'bg-gradient-to-r from-slate-300 to-slate-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>面积投票率: <span className="font-medium">{areaPercentage.toFixed(1)}%</span> (总面积 {formatArea(roundTotalArea)})</span>
                    <span>已投票面积: <span className="font-medium">{formatArea(roundVotedArea)}</span></span>
                  </div>
                </div>
              );
            })}
            {progress.length === 0 && (
              <div className="flex flex-col items-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Vote className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">暂无投票轮次</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
