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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { communityApi } from '@/lib/api';

interface Community {
  id: number;
  name: string;
}

const menuItems = [
  { href: '/dashboard', label: '首页', icon: Home },
  { href: '/dashboard/votes', label: '投票管理', icon: Vote },
  { href: '/dashboard/owners', label: '业主管理', icon: Users },
  { href: '/dashboard/communities', label: '小区管理', icon: Building2 },
  { href: '/dashboard/settings', label: '系统设置', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const loadCommunities = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const handleSelectCommunity = (community: Community) => {
    setSelectedCommunity(community);
    localStorage.setItem('selectedCommunityId', String(community.id));
    setShowDropdown(false);
    window.dispatchEvent(new CustomEvent('communityChanged', { detail: community }));
  };

  return (
    <div className="flex flex-col h-full w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Vote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">投票管理系统</h1>
            <p className="text-xs text-slate-400">业主大会投票</p>
          </div>
        </div>
      </div>

      {/* 小区选择器 */}
      <div className="p-4 border-b border-slate-700/50" ref={dropdownRef}>
        <label className="text-xs text-slate-400 font-medium block mb-2 uppercase tracking-wider">
          当前小区
        </label>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200',
              'bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50',
              showDropdown && 'ring-2 ring-blue-500/50 border-blue-500/50'
            )}
          >
            <span className="truncate font-medium">
              {selectedCommunity?.name || '请选择小区'}
            </span>
            <ChevronDown className={cn(
              'w-4 h-4 flex-shrink-0 transition-transform duration-200',
              showDropdown && 'rotate-180'
            )} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 rounded-lg shadow-xl shadow-black/20 z-50 max-h-60 overflow-y-auto border border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-200">
              {communities.map((community) => (
                <button
                  key={community.id}
                  onClick={() => handleSelectCommunity(community)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors',
                    'hover:bg-slate-700/50 first:rounded-t-lg last:rounded-b-lg',
                    selectedCommunity?.id === community.id && 'bg-blue-600/20 text-blue-400'
                  )}
                >
                  <span>{community.name}</span>
                  {selectedCommunity?.id === community.id && (
                    <Check className="w-4 h-4 text-blue-400" />
                  )}
                </button>
              ))}
              {communities.length === 0 && (
                <div className="px-3 py-4 text-slate-400 text-sm text-center">
                  暂无小区
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 菜单 */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              )}
            >
              <item.icon className={cn(
                'w-5 h-5 transition-transform duration-200',
                !isActive && 'group-hover:scale-110'
              )} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 用户信息 */}
      <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-sm font-bold">
            {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user?.name || user?.username}</p>
            <p className="text-xs text-slate-400">
              {user?.role === 'admin' ? '管理员' : '普通用户'}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
            title="退出登录"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
