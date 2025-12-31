'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Loader2, ChevronDown } from 'lucide-react';
import FloorGrid from './FloorGrid';
import RoomEditModal from './RoomEditModal';
import { voteApi, communityApi, ownerApi } from '@/lib/api';
import { UnitRoomsResponse, RoomData, Round, Phase } from './types';

interface Props {
  communityId: number | null;
}

export default function BuildingVoteVisualization({ communityId }: Props) {
  // 选择状态
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // 数据状态
  const [rounds, setRounds] = useState<Round[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [roomData, setRoomData] = useState<UnitRoomsResponse | null>(null);

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomData | null>(null);

  // 加载投票轮次
  useEffect(() => {
    if (!communityId) return;

    const loadRounds = async () => {
      try {
        const res = await voteApi.getRounds({ community_id: communityId });
        setRounds(res.data);
        // 默认选择第一个活跃的轮次
        const activeRound = res.data.find((r: Round) => r.status === 'active');
        if (activeRound) {
          setSelectedRound(activeRound.id);
        } else if (res.data.length > 0) {
          setSelectedRound(res.data[0].id);
        }
      } catch (error) {
        console.error('加载投票轮次失败:', error);
      }
    };

    loadRounds();
    // 重置选择
    setSelectedPhase(null);
    setSelectedBuilding(null);
    setSelectedUnit(null);
    setRoomData(null);
  }, [communityId]);

  // 加载期数
  useEffect(() => {
    if (!communityId) return;

    const loadPhases = async () => {
      try {
        const res = await communityApi.getPhases(communityId);
        setPhases(res.data);
        if (res.data.length > 0) {
          setSelectedPhase(res.data[0].id);
        }
      } catch (error) {
        console.error('加载期数失败:', error);
      }
    };

    loadPhases();
  }, [communityId]);

  // 加载楼栋
  useEffect(() => {
    if (!selectedPhase) {
      setBuildings([]);
      setSelectedBuilding(null);
      return;
    }

    const loadBuildings = async () => {
      try {
        const res = await ownerApi.getBuildings(selectedPhase);
        setBuildings(res.data);
        if (res.data.length > 0) {
          setSelectedBuilding(res.data[0]);
        }
      } catch (error) {
        console.error('加载楼栋失败:', error);
      }
    };

    loadBuildings();
    setSelectedUnit(null);
  }, [selectedPhase]);

  // 加载单元
  useEffect(() => {
    if (!selectedPhase || !selectedBuilding) {
      setUnits([]);
      setSelectedUnit(null);
      return;
    }

    const loadUnits = async () => {
      try {
        const res = await ownerApi.getUnits(selectedPhase, selectedBuilding);
        setUnits(res.data);
        if (res.data.length > 0) {
          setSelectedUnit(res.data[0]);
        }
      } catch (error) {
        console.error('加载单元失败:', error);
      }
    };

    loadUnits();
  }, [selectedPhase, selectedBuilding]);

  // 加载房间数据
  const loadRoomData = useCallback(async () => {
    if (!selectedRound || !selectedPhase || !selectedBuilding || !selectedUnit) {
      setRoomData(null);
      return;
    }

    try {
      setLoadingRooms(true);
      const res = await voteApi.getUnitRooms({
        round_id: selectedRound,
        phase_id: selectedPhase,
        building: selectedBuilding,
        unit: selectedUnit,
      });
      setRoomData(res.data);
    } catch (error) {
      console.error('加载房间数据失败:', error);
      setRoomData(null);
    } finally {
      setLoadingRooms(false);
    }
  }, [selectedRound, selectedPhase, selectedBuilding, selectedUnit]);

  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  // 处理编辑保存后刷新
  const handleRoomSaved = () => {
    loadRoomData();
  };

  // 选择器组件
  const Select = ({
    value,
    onChange,
    options,
    placeholder,
    disabled,
    renderOption,
  }: {
    value: string | number | null;
    onChange: (val: any) => void;
    options: any[];
    placeholder: string;
    disabled?: boolean;
    renderOption: (opt: any) => { value: any; label: string };
  }) => (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? (typeof options[0] === 'object' ? Number(e.target.value) : e.target.value) : null)}
        disabled={disabled || options.length === 0}
        className="appearance-none w-full px-3 py-2 pr-8 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => {
          const { value: optValue, label } = renderOption(opt);
          return (
            <option key={optValue} value={optValue}>
              {label}
            </option>
          );
        })}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  );

  if (!communityId) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 text-center text-slate-500">
        请先选择小区
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      {/* 标题 */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">楼栋投票状态</h2>
        </div>
      </div>

      {/* 选择器 */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 投票轮次 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">投票轮次</label>
            <Select
              value={selectedRound}
              onChange={setSelectedRound}
              options={rounds}
              placeholder="选择轮次"
              renderOption={(r: Round) => ({
                value: r.id,
                label: `${r.name}${r.status === 'active' ? ' (进行中)' : ''}`,
              })}
            />
          </div>

          {/* 期数 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">期数</label>
            <Select
              value={selectedPhase}
              onChange={setSelectedPhase}
              options={phases}
              placeholder="选择期数"
              renderOption={(p: Phase) => ({ value: p.id, label: p.name })}
            />
          </div>

          {/* 楼栋 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">楼栋</label>
            <Select
              value={selectedBuilding}
              onChange={setSelectedBuilding}
              options={buildings}
              placeholder="选择楼栋"
              disabled={!selectedPhase}
              renderOption={(b: string) => ({ value: b, label: `${b}号楼` })}
            />
          </div>

          {/* 单元 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">单元</label>
            <Select
              value={selectedUnit}
              onChange={setSelectedUnit}
              options={units}
              placeholder="选择单元"
              disabled={!selectedBuilding}
              renderOption={(u: string) => ({ value: u, label: `${u}单元` })}
            />
          </div>
        </div>
      </div>

      {/* 楼层图 */}
      {loadingRooms ? (
        <div className="p-12 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span>加载中...</span>
        </div>
      ) : roomData && roomData.meta.total_rooms > 0 ? (
        <FloorGrid data={roomData} onRoomClick={setEditingRoom} />
      ) : (
        <div className="p-12 text-center text-slate-400">
          {selectedRound && selectedPhase && selectedBuilding && selectedUnit
            ? '该单元没有房间数据'
            : '请选择投票轮次、期数、楼栋和单元'}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingRoom && selectedRound && (
        <RoomEditModal
          room={editingRoom}
          roundId={selectedRound}
          onClose={() => setEditingRoom(null)}
          onSaved={handleRoomSaved}
        />
      )}
    </div>
  );
}
