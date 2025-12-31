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

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

// 投票状态映射
export const voteStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '未投票', color: 'bg-gray-100 text-gray-800' },
  voted: { label: '已投票', color: 'bg-green-100 text-green-800' },
  refused: { label: '拒绝投票', color: 'bg-red-100 text-red-800' },
  onsite: { label: '现场投票', color: 'bg-blue-100 text-blue-800' },
  video: { label: '视频投票', color: 'bg-purple-100 text-purple-800' },
};

// 微信状态映射
export const wechatStatusMap: Record<string, { label: string; color: string }> = {
  '已加微信': { label: '已加微信', color: 'bg-green-100 text-green-800' },
  '无法添加': { label: '无法添加', color: 'bg-red-100 text-red-800' },
  '': { label: '未添加', color: 'bg-gray-100 text-gray-800' },
};

// 轮次状态映射
export const roundStatusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  active: { label: '进行中', color: 'bg-green-100 text-green-800' },
  closed: { label: '已结束', color: 'bg-blue-100 text-blue-800' },
};

// 扫楼状态映射
export const sweepStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待扫楼', color: 'bg-gray-100 text-gray-800' },
  in_progress: { label: '进行中', color: 'bg-amber-100 text-amber-800' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
};
