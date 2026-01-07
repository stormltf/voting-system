import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN');
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('zh-CN');
}

export function formatArea(area: number | string | null | undefined): string {
  if (area === null || area === undefined) return '-';
  const num = typeof area === 'string' ? parseFloat(area) : area;
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)} m²`;
}

export function formatPercent(value: number | null | undefined, total: number | null | undefined): string {
  const v = value ?? 0;
  const t = total ?? 0;
  if (t === 0) return '0%';
  const percent = (v / t) * 100;
  if (isNaN(percent) || !isFinite(percent)) return '0%';
  return `${percent.toFixed(1)}%`;
}

// 投票状态映射 - 鲜艳高对比配色
export const voteStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '未投票', color: 'bg-slate-100 text-slate-600 border border-slate-300' },
  voted: { label: '已投票', color: 'bg-emerald-500 text-white font-medium' },
  refused: { label: '拒绝投票', color: 'bg-rose-500 text-white font-medium' },
  onsite: { label: '现场投票', color: 'bg-blue-500 text-white font-medium' },
  video: { label: '视频投票', color: 'bg-violet-500 text-white font-medium' },
};

// 微信状态映射
export const wechatStatusMap: Record<string, { label: string; color: string }> = {
  '已加微信': { label: '已加微信', color: 'bg-emerald-500 text-white' },
  '无法添加': { label: '无法添加', color: 'bg-rose-500 text-white' },
  '': { label: '未添加', color: 'bg-slate-100 text-slate-600' },
};

// 轮次状态映射
export const roundStatusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  active: { label: '进行中', color: 'bg-emerald-500 text-white font-medium' },
  closed: { label: '已结束', color: 'bg-slate-500 text-white' },
};

// 扫楼状态映射 - 鲜艳高对比配色
export const sweepStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待扫楼', color: 'bg-slate-100 text-slate-600 border border-slate-300' },
  in_progress: { label: '进行中', color: 'bg-amber-500 text-white font-medium' },
  completed: { label: '已完成', color: 'bg-emerald-500 text-white font-medium' },
};
