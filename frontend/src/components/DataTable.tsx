'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  onRowClick?: (item: T) => void;
  selectedIds?: number[];
  onSelectChange?: (ids: number[]) => void;
  idKey?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  pagination,
  onPageChange,
  onRowClick,
  selectedIds,
  onSelectChange,
  idKey = 'id',
}: DataTableProps<T>) {
  const [localSelectedIds, setLocalSelectedIds] = useState<number[]>([]);
  const selected = selectedIds ?? localSelectedIds;
  const setSelected = onSelectChange ?? setLocalSelectedIds;

  const handleSelectAll = () => {
    if (selected.length === data.length) {
      setSelected([]);
    } else {
      setSelected(data.map((item) => item[idKey]));
    }
  };

  const handleSelectOne = (id: number) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((i) => i !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200/60">
              {onSelectChange && (
                <th className="px-4 py-4 text-left w-12">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selected.length === data.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-colors cursor-pointer"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider',
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectChange ? 1 : 0)}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-sm text-slate-500">加载中...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectChange ? 1 : 0)}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-500">暂无数据</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={item[idKey] || index}
                  className={cn(
                    'transition-colors duration-150',
                    onRowClick && 'cursor-pointer',
                    selected.includes(item[idKey])
                      ? 'bg-blue-50/50'
                      : 'hover:bg-slate-50/80'
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {onSelectChange && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(item[idKey])}
                        onChange={() => handleSelectOne(item[idKey])}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-colors cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-4 py-3 text-sm text-slate-700', column.className)}
                    >
                      {column.render
                        ? column.render(item)
                        : item[column.key] ?? <span className="text-slate-400">-</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {pagination && pagination.totalPages > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <div className="text-sm text-slate-600">
            共 <span className="font-semibold text-slate-900">{pagination.total}</span> 条记录，
            第 <span className="font-semibold text-slate-900">{pagination.page}</span> / {pagination.totalPages} 页
          </div>
          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => onPageChange?.(1)}
              disabled={pagination.page === 1}
              title="第一页"
            >
              <ChevronsLeft className="w-4 h-4" />
            </PaginationButton>
            <PaginationButton
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              title="上一页"
            >
              <ChevronLeft className="w-4 h-4" />
            </PaginationButton>

            {/* 页码显示 */}
            <div className="flex items-center gap-1 mx-1">
              {getPageNumbers(pagination.page, pagination.totalPages).map((pageNum, idx) => (
                pageNum === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum as number)}
                    className={cn(
                      'min-w-[32px] h-8 px-2 text-sm rounded-lg transition-all duration-200',
                      pagination.page === pageNum
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {pageNum}
                  </button>
                )
              ))}
            </div>

            <PaginationButton
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              title="下一页"
            >
              <ChevronRight className="w-4 h-4" />
            </PaginationButton>
            <PaginationButton
              onClick={() => onPageChange?.(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages}
              title="最后一页"
            >
              <ChevronsRight className="w-4 h-4" />
            </PaginationButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-2 rounded-lg transition-all duration-200',
        disabled
          ? 'text-slate-300 cursor-not-allowed'
          : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
      )}
    >
      {children}
    </button>
  );
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 5, '...', total];
  }

  if (current >= total - 2) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, '...', current - 1, current, current + 1, '...', total];
}
