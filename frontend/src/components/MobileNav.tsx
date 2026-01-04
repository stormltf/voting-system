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
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 text-white shadow-lg">
      <div className="flex items-center justify-between px-4 h-14">
        <button
          onClick={onToggle}
          className="min-w-[44px] min-h-[44px] p-2.5 -ml-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center"
          aria-label={isOpen ? '关闭菜单' : '打开菜单'}
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
        <h1 className="font-semibold text-lg">{title}</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>
    </header>
  );
}

// Overlay component for closing sidebar on mobile
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
        'lg:hidden fixed inset-0 bg-black/50 z-[45] transition-opacity duration-300',
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      onClick={onClose}
      aria-hidden="true"
    />
  );
}
