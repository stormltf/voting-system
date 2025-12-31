'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { voteApi } from '@/lib/api';
import { RoomData, voteStatusConfig, sweepStatusConfig } from './types';

interface Props {
  room: RoomData;
  roundId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function RoomEditModal({ room, roundId, onClose, onSaved }: Props) {
  const [voteStatus, setVoteStatus] = useState(room.vote_status || 'pending');
  const [remark, setRemark] = useState(room.remark || '');
  const [sweepStatus, setSweepStatus] = useState(room.sweep_status || 'pending');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await voteApi.saveVote({
        owner_id: room.owner_id,
        round_id: roundId,
        vote_status: voteStatus,
        vote_date: new Date().toISOString().split('T')[0],
        remark: remark || null,
        sweep_status: sweepStatus || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = Object.entries(voteStatusConfig);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{room.room_number}</h3>
            <p className="text-sm text-slate-500">{room.owner_name || '未知业主'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-5">
          {/* 房间信息 */}
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">电话</span>
              <span className="text-slate-900">{room.phone1 || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">面积</span>
              <span className="text-slate-900">{room.area ? `${room.area} m²` : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">车位</span>
              <span className="text-slate-900">{room.parking_no || '-'}</span>
            </div>
          </div>

          {/* 投票状态 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">投票状态</label>
            <div className="grid grid-cols-3 gap-2">
              {statusOptions.map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setVoteStatus(key)}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${voteStatus === key
                      ? 'ring-2 ring-blue-500 ring-offset-2'
                      : 'hover:bg-slate-100'
                    }
                    ${value.bgColor} ${value.color}
                  `}
                >
                  {value.label}
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">备注</label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="添加备注..."
            />
          </div>

          {/* 扫楼状态 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">扫楼状态</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(sweepStatusConfig).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setSweepStatus(key)}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${sweepStatus === key
                      ? 'ring-2 ring-amber-500 ring-offset-2'
                      : 'hover:bg-slate-100'
                    }
                    ${value.bgColor} ${value.color}
                  `}
                >
                  {value.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
