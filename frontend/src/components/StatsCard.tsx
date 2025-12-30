'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  color?: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const colorConfig = {
  default: {
    bg: 'bg-white',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    accent: 'from-slate-500 to-slate-600',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
    iconBg: 'bg-blue-500',
    iconText: 'text-white',
    accent: 'from-blue-500 to-blue-600',
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
    iconBg: 'bg-emerald-500',
    iconText: 'text-white',
    accent: 'from-emerald-500 to-emerald-600',
  },
  yellow: {
    bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
    iconBg: 'bg-amber-500',
    iconText: 'text-white',
    accent: 'from-amber-500 to-amber-600',
  },
  red: {
    bg: 'bg-gradient-to-br from-red-50 to-red-100/50',
    iconBg: 'bg-red-500',
    iconText: 'text-white',
    accent: 'from-red-500 to-red-600',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-50 to-purple-100/50',
    iconBg: 'bg-purple-500',
    iconText: 'text-white',
    accent: 'from-purple-500 to-purple-600',
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  color = 'default',
}: StatsCardProps) {
  const config = colorConfig[color];

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-slate-200/60 p-6 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group',
        config.bg,
        className
      )}
    >
      {/* 装饰性背景 */}
      <div className={cn(
        'absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 bg-gradient-to-br',
        config.accent
      )} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                  trend.value >= 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                )}
              >
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-slate-400">{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'p-3 rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-110',
            config.iconBg,
            config.iconText
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
