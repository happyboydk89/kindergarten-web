'use client';

import { useAuth } from '@/hooks/use-auth';

export default function DashboardPage() {
  const { user, role, isAuthenticated } = useAuth();

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
        <p className="mt-2 text-muted-foreground">Trang tổng quan đang được xây dựng.</p>
        <pre className="mt-6 rounded bg-slate-100 p-4 text-left text-xs text-slate-700">
          {JSON.stringify({ isAuthenticated, role, user }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
