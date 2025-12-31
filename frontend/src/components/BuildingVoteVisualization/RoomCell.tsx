'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { RoomData, voteStatusConfig } from './types';

// 扫楼状态配置
const sweepStatusConfig: Record<string, { label: string; borderColor: string }> = {
  completed: { label: '已扫楼', borderColor: 'ring-2 ring-amber-400' },
  in_progress: { label: '扫楼中', borderColor: 'ring-2 ring-amber-300 ring-dashed' },
  pending: { label: '待扫楼', borderColor: '' },
};

interface Props {
  room: RoomData;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

export default function RoomCell({ room, onClick, selectable, selected, onSelect }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const status = voteStatusConfig[room.vote_status] || voteStatusConfig.pending;
  const sweepStatus = sweepStatusConfig[room.sweep_status || 'pending'] || sweepStatusConfig.pending;

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(!selected);
    } else {
      onClick();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          text-xs font-medium
          transition-all duration-200 cursor-pointer
          shadow-sm hover:shadow-md hover:scale-105
          ${status.bgColor} ${status.color}
          ${sweepStatus.borderColor}
          ${selected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        `}
      >
        {selectable && selected ? (
          <Check className="w-4 h-4" />
        ) : (
          room.room_in_floor
        )}
      </button>

      {/* 悬停提示 */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="bg-slate-900 text-white rounded-lg shadow-xl p-3 text-sm min-w-48 whitespace-nowrap">
            <div className="font-medium mb-2">{room.room_number}</div>
            <div className="space-y-1 text-slate-300 text-xs">
              <div className="flex justify-between gap-4">
                <span>业主:</span>
                <span className="text-white">{room.owner_name || '-'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>电话:</span>
                <span className="text-white">{room.phone1 || '-'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>面积:</span>
                <span className="text-white">{room.area ? `${room.area} m²` : '-'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>投票:</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${status.bgColor} ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>扫楼:</span>
                <span className="text-amber-400">{sweepStatus.label}</span>
              </div>
              {room.remark && (
                <div className="pt-1 border-t border-slate-700 mt-1">
                  <span className="text-slate-400">备注: </span>
                  <span>{room.remark}</span>
                </div>
              )}
            </div>
            {/* 箭头 */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}
