'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Building2,
  Users,
  Vote,
  Settings,
  LogOut,
  ChevronDown,
  Check,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { communityApi } from '@/lib/api';

interface Community {
  id: number;
  name: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { href: '/dashboard', label: '首页', icon: Home },
  { href: '/dashboard/votes', label: '投票管理', icon: Vote },
  { href: '/dashboard/owners', label: '业主管理', icon: Users },
  { href: '/dashboard/communities', label: '小区管理', icon: Building2 },
  { href: '/dashboard/settings', label: '系统设置', icon: Settings },
];

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeSidebar = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadCommunities = async () => {
      try {
        const response = await communityApi.getAll();
        setCommunities(response.data);
        const savedId = localStorage.getItem('selectedCommunityId');
        if (savedId && response.data.length > 0) {
          const found = response.data.find((c: Community) => c.id === parseInt(savedId));
          setSelectedCommunity(found || response.data[0]);
        } else if (response.data.length > 0) {
          setSelectedCommunity(response.data[0]);
        }
      } catch (error) {
        console.error('加载小区列表失败:', error);
      }
    };
    loadCommunities();
  }, []);

  const handleSelectCommunity = (community: Community) => {
    setSelectedCommunity(community);
    localStorage.setItem('selectedCommunityId', String(community.id));
    setShowDropdown(false);
    window.dispatchEvent(new CustomEvent('communityChanged', { detail: community }));
  };

  // Handle link click on mobile - close sidebar
  const handleLinkClick = () => {
    closeSidebar();
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full w-64 bg-white border-r border-zinc-200/80',
        'fixed lg:static inset-y-0 left-0 z-50',
        'transform transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="p-5 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Vote className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-[15px] font-semibold text-zinc-900 tracking-tight">投票管理系统</h1>
            <p className="text-xs text-zinc-400">业主大会投票</p>
          </div>
          <button
            className="lg:hidden p-2 hover:bg-zinc-100 rounded-md transition-colors"
            onClick={closeSidebar}
            aria-label="关闭菜单"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-zinc-100" ref={dropdownRef}>
        <label className="text-[11px] text-zinc-400 font-medium block mb-2 uppercase tracking-wide">
          当前小区
        </label>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200',
              'bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 text-zinc-700',
              showDropdown && 'ring-2 ring-blue-500/20 border-blue-300'
            )}
          >
            <span className="truncate text-[13px] font-medium">
              {selectedCommunity?.name || '请选择小区'}
            </span>
            <ChevronDown className={cn(
              'w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 text-zinc-400',
              showDropdown && 'rotate-180'
            )} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-lg shadow-lg shadow-zinc-900/10 z-50 max-h-60 overflow-y-auto border border-zinc-200 animate-slide-down">
              {communities.map((community) => (
                <button
                  key={community.id}
                  onClick={() => handleSelectCommunity(community)}
                  className={cn(
                    'w-full text-left px-3 py-2 flex items-center justify-between transition-colors text-[13px]',
                    'hover:bg-zinc-50 first:rounded-t-lg last:rounded-b-lg',
                    selectedCommunity?.id === community.id && 'bg-blue-50 text-blue-600'
                  )}
                >
                  <span>{community.name}</span>
                  {selectedCommunity?.id === community.id && (
                    <Check className="w-3.5 h-3.5 text-blue-500" />
                  )}
                </button>
              ))}
              {communities.length === 0 && (
                <div className="px-3 py-4 text-zinc-400 text-[13px] text-center">
                  暂无小区
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <item.icon className={cn(
                'w-[18px] h-[18px] transition-colors duration-200',
                isActive ? 'text-zinc-700' : 'text-zinc-400 group-hover:text-zinc-600'
              )} />
              <span className="text-[13px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600">
            {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-zinc-800 truncate">{user?.name || user?.username}</p>
            <p className="text-[11px] text-zinc-400">
              {user?.role === 'super_admin' ? '超级管理员' : user?.role === 'community_admin' ? '小区管理员' : '普通用户'}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all duration-200"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="lg:hidden p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
      onClick={onClick}
      aria-label="打开菜单"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
