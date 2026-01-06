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
    iconBg: 'bg-zinc-100',
    iconText: 'text-zinc-600',
  },
  blue: {
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
  },
  green: {
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
  },
  yellow: {
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
  },
  red: {
    iconBg: 'bg-red-50',
    iconText: 'text-red-600',
  },
  purple: {
    iconBg: 'bg-violet-50',
    iconText: 'text-violet-600',
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
        'relative bg-white rounded-xl border border-zinc-200/80 p-5 transition-all duration-200 hover:border-zinc-300',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-[13px] font-medium text-zinc-500">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
          {subtitle && (
            <p className="text-[12px] text-zinc-400 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 pt-1">
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium',
                  trend.value >= 0
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                )}
              >
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-[11px] text-zinc-400">{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'p-2.5 rounded-lg flex-shrink-0',
            config.iconBg,
            config.iconText
          )}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
