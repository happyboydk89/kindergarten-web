'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/shared/sidebar';
import { Navbar } from '@/components/shared/navbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Navbar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
            onMobileMenuOpen={() => setMobileOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
