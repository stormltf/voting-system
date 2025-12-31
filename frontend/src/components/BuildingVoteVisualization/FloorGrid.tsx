'use client';

import { useMemo } from 'react';
import RoomCell from './RoomCell';
import { UnitRoomsResponse, RoomData } from './types';

interface Props {
  data: UnitRoomsResponse;
  onRoomClick: (room: RoomData) => void;
  selectable?: boolean;
  selectedRooms?: Set<number>;
  onSelectRoom?: (ownerId: number, selected: boolean) => void;
}

export default function FloorGrid({ data, onRoomClick, selectable, selectedRooms, onSelectRoom }: Props) {
  const { floors, meta } = data;

  // 从高到低排列楼层
  const sortedFloors = useMemo(() => {
    return Object.keys(floors)
      .map(Number)
      .filter(f => f > 0)
      .sort((a, b) => b - a);
  }, [floors]);

  if (sortedFloors.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        该单元没有房间数据
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 统计信息 */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{meta.phase_name}</span>
          <span className="mx-2">/</span>
          <span>{meta.building}号楼 {meta.unit}单元</span>
          <span className="mx-2">·</span>
          <span className="text-slate-500">共 {meta.total_rooms} 户</span>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500"></span>
            已投票 {meta.voted_count}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-500"></span>
            拒绝 {meta.refused_count}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-300"></span>
            待投票 {meta.pending_count}
          </span>
        </div>
      </div>

      {/* 楼层网格 */}
      <div className="relative border border-slate-200 rounded-xl overflow-hidden">
        {sortedFloors.map(floor => (
          <div
            key={floor}
            className="flex items-stretch border-b border-slate-100 last:border-b-0"
          >
            {/* 楼层标签 */}
            <div className="w-14 flex-shrink-0 bg-slate-50 flex items-center justify-center border-r border-slate-100">
              <span className="text-xs font-medium text-slate-500">{floor}F</span>
            </div>

            {/* 房间格子 */}
            <div className="flex-1 flex gap-2 p-3 flex-wrap">
              {floors[floor]
                .sort((a, b) => a.room_in_floor.localeCompare(b.room_in_floor))
                .map(room => (
                  <RoomCell
                    key={room.owner_id}
                    room={room}
                    onClick={() => onRoomClick(room)}
                    selectable={selectable}
                    selected={selectedRooms?.has(room.owner_id)}
                    onSelect={(selected) => onSelectRoom?.(room.owner_id, selected)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
