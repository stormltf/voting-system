'use client';

import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { SweepRoomData, sweepStatusConfig } from './types';
import { voteApi } from '@/lib/api';

interface Props {
  room: SweepRoomData;
  roundId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function SweepEditModal({ room, roundId, onClose, onSaved }: Props) {
  const [sweepStatus, setSweepStatus] = useState(room.sweep_status || 'pending');
  const [sweepRemark, setSweepRemark] = useState(room.sweep_remark || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await voteApi.updateSweepStatus(room.owner_id, {
        round_id: roundId,
        sweep_status: sweepStatus,
        sweep_remark: sweepRemark,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* 标题 */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">编辑扫楼状态</h3>
            <p className="text-sm text-slate-500 mt-0.5">{room.room_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4">
          {/* 业主信息 */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">业主:</span>
                <span className="ml-2 text-slate-900">{room.owner_name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">电话:</span>
                <span className="ml-2 text-slate-900">{room.phone1 || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">面积:</span>
                <span className="ml-2 text-slate-900">{room.area ? `${room.area} m²` : '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">车位:</span>
                <span className="ml-2 text-slate-900">{room.parking_no || '-'}</span>
              </div>
            </div>
          </div>

          {/* 扫楼状态 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">扫楼状态</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(sweepStatusConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setSweepStatus(key)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                    sweepStatus === key
                      ? `${config.bgColor} ${config.color} ring-2 ring-offset-2 ring-${config.bgColor.replace('bg-', '')}`
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">备注</label>
            <textarea
              value={sweepRemark}
              onChange={(e) => setSweepRemark(e.target.value)}
              placeholder="添加备注信息..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
              rows={3}
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        </div>

        {/* 操作按钮 */}
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
