'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasRedirected = useRef(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/login');
    }
  }, [user, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header with menu button */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <h1 className="font-semibold text-slate-800">投票管理系统</h1>
        </div>

        {/* Page content */}
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
