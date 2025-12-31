'use client';

import { SweepUnitRoomsResponse, SweepRoomData } from './types';
import SweepRoomCell from './SweepRoomCell';

interface Props {
  data: SweepUnitRoomsResponse;
  onRoomClick: (room: SweepRoomData) => void;
}

export default function SweepFloorGrid({ data, onRoomClick }: Props) {
  const { floors, stats, meta } = data;

  // 从最高楼层到最低楼层排序
  const sortedFloors = Object.keys(floors)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="p-4">
      {/* 统计信息 */}
      <div className="mb-4 flex items-center gap-4 text-sm">
        <span className="text-slate-600">
          共 <span className="font-semibold text-slate-900">{meta.total_rooms}</span> 户
        </span>
        <span className="text-emerald-600">
          已完成 <span className="font-semibold">{meta.completed_count}</span>
        </span>
        <span className="text-amber-600">
          进行中 <span className="font-semibold">{meta.in_progress_count}</span>
        </span>
        <span className="text-slate-500">
          待扫楼 <span className="font-semibold">{meta.pending_count}</span>
        </span>
      </div>

      {/* 图例 */}
      <div className="mb-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-500" />
          <span className="text-slate-600">已完成</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-500" />
          <span className="text-slate-600">进行中</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-slate-300" />
          <span className="text-slate-600">待扫楼</span>
        </div>
      </div>

      {/* 楼层网格 */}
      <div className="space-y-2">
        {sortedFloors.map((floor) => (
          <div key={floor} className="flex items-center gap-3">
            {/* 楼层标签 */}
            <div className="w-12 text-right text-sm text-slate-500 font-medium">
              {floor}F
            </div>
            {/* 房间格子 */}
            <div className="flex gap-2 flex-wrap">
              {floors[floor]
                .sort((a, b) => a.room_in_floor.localeCompare(b.room_in_floor))
                .map((room) => (
                  <SweepRoomCell
                    key={room.owner_id}
                    room={room}
                    onClick={() => onRoomClick(room)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {sortedFloors.length === 0 && (
        <div className="py-8 text-center text-slate-400">暂无楼层数据</div>
      )}
    </div>
  );
}
