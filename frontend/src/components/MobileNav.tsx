'use client';

import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
}

export default function MobileNav({ isOpen, onToggle, title = '投票管理系统' }: MobileNavProps) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200/80">
      <div className="flex items-center justify-between px-4 h-12">
        <button
          onClick={onToggle}
          className="min-w-[40px] min-h-[40px] p-2 -ml-2 rounded-md hover:bg-zinc-100 transition-colors flex items-center justify-center"
          aria-label={isOpen ? '关闭菜单' : '打开菜单'}
        >
          {isOpen ? (
            <X className="w-5 h-5 text-zinc-600" />
          ) : (
            <Menu className="w-5 h-5 text-zinc-600" />
          )}
        </button>
        <h1 className="text-[14px] font-medium text-zinc-800">{title}</h1>
        <div className="w-10" />
      </div>
    </header>
  );
}

export function MobileOverlay({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'lg:hidden fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-[45] transition-opacity duration-200',
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      onClick={onClose}
      aria-hidden="true"
    />
  );
}
